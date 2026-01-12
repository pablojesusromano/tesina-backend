import type { FastifyRequest, FastifyReply } from 'fastify'
import { findUserById } from '../models/user.js'

export async function protectUserRoute(req: FastifyRequest, reply: FastifyReply) {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers.authorization
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ 
                message: 'No autorizado. Debe incluir header: Authorization: Bearer <token>' 
            })
        }

        // Extraer el token (remover "Bearer ")
        const token = authHeader.substring(7)
        
        // Verificar el token
        const payload = req.server.jwt.verify(token) as { userId?: number; type?: string }
        
        if (!payload.userId || payload.type !== 'user') {
            return reply.code(401).send({ message: 'Token inválido' })
        }
        
        // Buscar el usuario en la base de datos
        const user = await findUserById(payload.userId)
        if (!user) {
            return reply.code(401).send({ message: 'Usuario no encontrado' })
        }
        
        // Adjuntar usuario a la request para usarlo en los controladores
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