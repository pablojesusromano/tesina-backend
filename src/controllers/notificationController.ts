import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    getUserNotifications,
    markNotificationAsRead,
    markNotificationAsClaimed,
    getNotificationById,
    createBroadcastFanout
} from '../models/notification.js'
import { findNotificationTypeByKey } from '../models/notificationType.js'
import { markActionHistoryAsClaimed, calculateUserTotalExp } from '../models/userActionHistory.js'
import { updateUser, findUserById } from '../models/user.js'

export async function getMyNotifications(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    try {
        const notifications = await getUserNotifications(user.id)

        const parsed = notifications.map(notif => {
            let finalBody = notif.body || ''
            const finalTitle = notif.title || ''

            let dataObj: any = {}
            if (typeof notif.data === 'string') {
                try {
                    dataObj = JSON.parse(notif.data)
                } catch (e) { }
            } else if (notif.data) {
                dataObj = notif.data
            }

            const varRegex = /\{([^}]+)\}/g
            finalBody = finalBody.replace(varRegex, (match, key) => {
                return dataObj && dataObj[key] !== undefined ? dataObj[key] : match
            })

            return {
                id: notif.id,
                n_key: notif.n_key,
                type: notif.type,
                title: finalTitle,
                body: finalBody,
                original_data: dataObj,
                is_read: Boolean(notif.is_read),
                is_claimed: Boolean(notif.is_claimed),
                created_at: notif.created_at
            }
        })

        return reply.send({ notifications: parsed })
    } catch (error) {
        console.error('Error listing notifications', error)
        return reply.code(500).send({ message: 'Error interno obteniendo notificaciones' })
    }
}

export async function readNotification(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }

    try {
        const success = await markNotificationAsRead(Number(id), user.id)
        if (!success) {
            return reply.code(404).send({ message: 'Notificación no encontrada' })
        }
        return reply.send({ message: 'Notificación leída' })
    } catch (error) {
        return reply.code(500).send({ message: 'Error marcando como leída' })
    }
}

export async function claimNotification(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }
    const notifId = Number(id)

    try {
        const notif = await getNotificationById(notifId)

        if (!notif || notif.user_id !== user.id) {
            return reply.code(404).send({ message: 'Notificación no encontrada' })
        }

        if (notif.is_claimed) {
            return reply.code(400).send({ message: 'Ya reclamaste este premio' })
        }

        // Marcar como reclamado (lo hacemos primero para evitar race conditions básicas)
        const success = await markNotificationAsClaimed(notifId, user.id)
        if (!success) return reply.code(500).send({ message: 'Fallo al marcar' })

        // Si es una acción gamificada, desbloqueamos la EXP en el historial
        let dataObj: any = {}
        if (typeof notif.data === 'string') {
            try { dataObj = JSON.parse(notif.data) } catch(e) {}
        } else if (notif.data) {
            dataObj = notif.data
        }

        if (dataObj && dataObj.historyId) {
            const historyClaimed = await markActionHistoryAsClaimed(dataObj.historyId)
            
            if (historyClaimed) {
                // Ahora sí recalculamos la experiencia y nivel verdaderos del usuario
                const newExp = await calculateUserTotalExp(user.id)
                const calculatedLevel = Math.floor(Math.sqrt(newExp / 100))
                const newLevel = calculatedLevel < 1 ? 1 : calculatedLevel

                await updateUser(user.id, { exp: newExp, level: newLevel })
                console.log(`[Reclamo] Usuario ${user.id} reclamó notificación ${notifId}. Nueva EXP: ${newExp}, Nivel: ${newLevel}`)
            }
        } else if (dataObj && dataObj.prizeAmount) {
            // Si era un "premio genérico" sin historyId (Ej: admin te regala 50pts)
            // Se asume que tendríamos que sumarlo directo, aunque la exp oficial viene del historial.
            // Para mantener consistencia, si deseas sumar premios sueltos, requeriría guardar la acción genérica en el history.
            // Por ahora, solo sumamos lo que está enlazado a un historyId real.
        }

        // Also marcamos como leida implicitamente
        if (!notif.is_read) {
            await markNotificationAsRead(notifId, user.id)
        }

        // Obtenemos user actualizado para responder
        const updatedUser = await findUserById(user.id)

        return reply.send({ 
            message: 'Premio reclamado exitosamente',
            user: {
                exp: updatedUser?.exp || 0,
                level: updatedUser?.level || 1
            }
        })
    } catch (error) {
        console.error('Error', error)
        return reply.code(500).send({ message: 'Error reclamando notificación' })
    }
}

// Para administradores (Enviar una genérica como el torneo de pesca)
export async function broadcastNotification(req: FastifyRequest, reply: FastifyReply) {
    const { notificationKey, data } = req.body as { notificationKey: string, data: any }

    if (!notificationKey) return reply.code(400).send({ message: 'Requiere notificationKey' })

    try {
        const type = await findNotificationTypeByKey(notificationKey)
        if (!type) {
            return reply.code(404).send({ message: 'Plantilla de notificación no existe' })
        }

        // Hace el FANOUT a todos
        const affected = await createBroadcastFanout(type.id, data || {})

        return reply.send({
            message: 'Alerta Global enviada mediante Fanout',
            users_affected: affected
        })
    } catch (e) {
        return reply.code(500).send({ message: 'Error interno broadcast' })
    }
}
