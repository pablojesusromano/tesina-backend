import type { FastifyRequest, FastifyReply } from 'fastify'
import { findUserById } from '../models/user.js'

export async function protectRoute(req: FastifyRequest, reply: FastifyReply) {
    try {
        await (req as any).jwtVerify()

        const userId = (req as any).user?.userId
        if (!userId) return reply.code(401).send({ message: 'Token inválido: falta userId' })

        const user = await findUserById(Number(userId))
        if (!user) return reply.code(401).send({ message: 'No autorizado: usuario no encontrado' })

            // adjunta el usuario a la request para handlers posteriores
            ; (req as any).user = user
    } catch {
        return reply.code(401).send({ message: 'No autorizado: token inválido o ausente' })
    }
}
