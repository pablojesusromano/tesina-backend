import type { FastifyRequest, FastifyReply } from 'fastify'
import { findUserById } from '../models/user'

export async function protectUserRoute(req: FastifyRequest, reply: FastifyReply) {
    try {
        // Verifica la cookie userToken
        const token = req.cookies?.userToken
        if (!token) {
            return reply.code(401).send({ message: 'Token no proporcionado' })
        }

        const payload = req.server.jwt.verify(token) as { userId?: number; type?: string }
        const userId = payload?.userId

        if (!userId || payload.type !== 'user') {
            return reply.code(401).send({ message: 'Token inválido' })
        }

        const user = await findUserById(userId)
        if (!user) {
            return reply.code(401).send({ message: 'Usuario no encontrado' })
        }

        // Adjuntar user a la request
        (req as any).user = user

    } catch {
        return reply.code(401).send({ message: 'Token inválido o ausente' })
    }
}