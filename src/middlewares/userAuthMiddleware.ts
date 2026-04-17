import type { FastifyRequest, FastifyReply } from 'fastify'
import { findUserById } from '../models/user.js'

export async function protectUserRoute(req: FastifyRequest, reply: FastifyReply) {
    try {
        const authHeader = req.headers.authorization
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            reply.code(401).send({ message: 'No autorizado' })
            return
        }

        const token = authHeader.substring(7)
        
        const payload = req.server.jwt.verify(token) as { userId?: number; type?: string }
        
        if (!payload.userId || payload.type !== 'user') {
            reply.code(401).send({ message: 'Token inválido' })
            return
        }
        
        const user = await findUserById(payload.userId)
        if (!user) {
            return reply.code(401).send({ message: 'Usuario no encontrado' })
        }

        // Bloquear usuarios con cuenta eliminada lógicamente
        if (user.deleted_at) {
            return reply.code(403).send({
                message: 'Cuenta eliminada. Iniciá sesión nuevamente para reactivarla.',
                code: 'ACCOUNT_DELETED'
            })
        }
        
        ;(req as any).user = user
        
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return reply.code(401).send({ 
                message: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            })
        }
        
        return reply.code(401).send({ message: 'Token inválido' })
    }
}