import type { FastifyRequest, FastifyReply } from 'fastify'
import { createDevice, getDevicesByUserId, updateDeviceToken } from '../models/device.js'

export async function registerDevice(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { token, tipo = 'ANDROID' } = req.body as { token: string, user_id?: number, tipo?: string }

    if (!token) {
        return reply.code(400).send({ message: 'El token es requerido' })
    }

    try {
        const insertId = await createDevice(user.id, token, tipo)
        return reply.code(201).send({ message: 'Dispositivo registrado exitosamente', id: insertId })
    } catch (error) {
        console.error('Error registrando dispositivo:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

export async function listUserDevices(req: FastifyRequest, reply: FastifyReply) {
    // Listar dispositivos por usuario en base al id de la ruta /:id
    const { id } = req.params as { id: string }
    const targetUserId = Number(id)

    try {
        const devices = await getDevicesByUserId(targetUserId)
        return reply.send({ devices })
    } catch (error) {
        console.error('Error listando dispositivos:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

export async function modifyDeviceToken(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }
    const deviceId = Number(id)
    const { token } = req.body as { token: string }

    if (!token) {
        return reply.code(400).send({ message: 'El nuevo token es requerido' })
    }

    try {
        const success = await updateDeviceToken(deviceId, user.id, token)
        if (!success) {
            return reply.code(404).send({ message: 'Dispositivo no encontrado o no pertenece a este usuario' })
        }
        return reply.send({ message: 'Token de dispositivo actualizado exitosamente' })
    } catch (error) {
        console.error('Error actualizando token de dispositivo:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}
