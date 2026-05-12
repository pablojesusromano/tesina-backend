import type { FastifyInstance } from 'fastify'
import { getDevicesByUserId, getTokensByTarget } from '../models/device.js'

export interface SightingNotificationData {
    postId: number
    userName: string
    latitude?: number | null
    longitude?: number | null
}

export async function sendSightingNotification(
    app: FastifyInstance,
    data: SightingNotificationData
): Promise<void> {
    try {
        const { postId, userName, latitude, longitude } = data

        const message = {
            topic: 'sightings',
            notification: {
                title: '🐋 Nuevo avistamiento de cetáceos!',
                body: `${userName} ha registrado un avistaje. Toca para ver.`,
            },
            data: {
                postId: postId.toString(),
                latitude: latitude?.toString() ?? '',
                longitude: longitude?.toString() ?? '',
                type: 'new_sighting'
            },
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: 'sightings',
                    sound: 'default',
                    priority: 'high' as const
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        }

        const response = await app.firebase.messaging().send(message)
        
        app.log.info({
            msg: 'Notificación enviada',
            postId,
            messageId: response
        })

    } catch (error) {
        app.log.error({
            msg: 'Error enviando notificación FCM',
            error,
            postId: data.postId
        })
    }
}

export interface ResearchNotificationData {
    postId: number
    userName: string
}

export async function sendResearchNotification(
    app: FastifyInstance,
    data: ResearchNotificationData
): Promise<void> {
    try {
        const { postId, userName } = data

        const message = {
            topic: 'sightings',
            notification: {
                title: '🔬 ¡Avistamiento destacado!',
                body: `El avistamiento de ${userName} fue seleccionado para investigación científica.`,
            },
            data: {
                postId: postId.toString(),
                type: 'research_selected'
            },
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: 'sightings',
                    sound: 'default',
                    priority: 'high' as const
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        }

        const response = await app.firebase.messaging().send(message)

        app.log.info({
            msg: 'Notificación de investigación enviada',
            postId,
            messageId: response
        })

    } catch (error) {
        app.log.error({
            msg: 'Error enviando notificación FCM de investigación',
            error,
            postId: data.postId
        })
    }
}

// ==================== NOTIFICACIÓN DE ETIQUETADO ====================
export interface TagNotificationData {
    postId: number
    taggerName: string
    taggedUserIds: number[]
}

export async function sendTagNotification(
    app: FastifyInstance,
    data: TagNotificationData
): Promise<void> {
    try {
        const { postId, taggerName, taggedUserIds } = data

        if (!taggedUserIds.length) return

        // Obtener tokens de dispositivos de cada usuario etiquetado
        const allDevices = await Promise.all(
            taggedUserIds.map(uid => getDevicesByUserId(uid))
        )

        const tokens = allDevices
            .flat()
            .map(d => d.token)
            .filter(Boolean)

        if (!tokens.length) return

        // Enviar a cada token individualmente
        const sendPromises = tokens.map(token => {
            const message = {
                token,
                notification: {
                    title: '🏷️ Te etiquetaron en un avistaje',
                    body: `${taggerName} te etiquetó en su avistamiento. ¡Toca para ver!`,
                },
                data: {
                    postId: postId.toString(),
                    type: 'tagged_in_post'
                },
                android: {
                    priority: 'high' as const,
                    notification: {
                        channelId: 'sightings',
                        sound: 'default',
                        priority: 'high' as const
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            }

            return app.firebase.messaging().send(message).catch(err => {
                app.log.warn({ msg: 'Error enviando push a token', token, err })
            })
        })

        await Promise.allSettled(sendPromises)

        app.log.info({
            msg: 'Notificaciones de etiquetado enviadas',
            postId,
            taggedCount: taggedUserIds.length,
            tokensCount: tokens.length
        })

    } catch (error) {
        app.log.error({
            msg: 'Error enviando notificaciones de etiquetado',
            error,
            postId: data.postId
        })
    }
}

// ==================== NOTIFICACIÓN CUSTOM BROADCAST ====================
export interface CustomBroadcastPushData {
    title: string
    body: string
    target: 'all' | 'gamified' | 'non_gamified'
}

export async function sendCustomBroadcastPush(
    app: FastifyInstance,
    data: CustomBroadcastPushData
): Promise<void> {
    try {
        const { title, body, target } = data

        const tokens = await getTokensByTarget(target)

        if (!tokens.length) {
            app.log.info({ msg: 'sendCustomBroadcastPush: no hay tokens registrados', target })
            return
        }

        // FCM acepta máximo 500 tokens por sendEachForMulticast
        const BATCH_SIZE = 500
        let successCount = 0
        let failureCount = 0

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batch = tokens.slice(i, i + BATCH_SIZE)

            const multicastMessage = {
                tokens: batch,
                notification: {
                    title,
                    body,
                },
                data: {
                    type: 'admin_mensaje',
                    customTitle: title,
                    customBody: body,
                },
                android: {
                    priority: 'high' as const,
                    notification: {
                        channelId: 'sightings',
                        sound: 'default',
                        priority: 'high' as const
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            }

            const response = await app.firebase.messaging().sendEachForMulticast(multicastMessage)
            successCount += response.successCount
            failureCount += response.failureCount

            // Loguear tokens que fallaron (ej: token expirado)
            response.responses.forEach((res, idx) => {
                if (!res.success) {
                    app.log.warn({
                        msg: 'Token FCM fallido en custom broadcast',
                        token: batch[idx],
                        error: res.error?.message
                    })
                }
            })
        }

        app.log.info({
            msg: 'Custom broadcast push enviado',
            target,
            totalTokens: tokens.length,
            successCount,
            failureCount
        })

    } catch (error) {
        app.log.error({
            msg: 'Error enviando custom broadcast push FCM',
            error,
            target: data.target
        })
    }
}