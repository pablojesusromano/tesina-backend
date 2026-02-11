import type { FastifyInstance } from 'fastify'

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