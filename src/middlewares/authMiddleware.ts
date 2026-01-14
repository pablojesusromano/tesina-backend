import type { FastifyRequest, FastifyReply } from 'fastify'
import { findAdminById } from '../models/admin.js'
import { findUserById } from '../models/user.js'
// Middleware para proteger rutas de ADMINS (sistema de gestión)
export async function protectAdminRoute(req: FastifyRequest, reply: FastifyReply) {
    try {
        const token = req.cookies?.adminToken
        if (!token) {
            return reply.code(401).send({ message: 'Token no proporcionado' })
        }

        const payload = req.server.jwt.verify(token) as { adminId?: number; type?: string }
        const adminId = payload?.adminId

        if (!adminId || payload.type !== 'admin') {
            return reply.code(401).send({ message: 'Token inválido' })
        }

        const admin = await findAdminById(adminId)
        if (!admin) {
            return reply.code(401).send({ message: 'Admin no encontrado' })
        }

        // Adjuntar admin a la request
        (req as any).admin = admin

    } catch {
        return reply.code(401).send({ message: 'Token inválido o ausente' })
    }
}

/**
 * Middleware que acepta AMBOS tipos de autenticación:
 * - Admins: cookies (adminToken)
 * - Users: Authorization header (Bearer token)
 * 
 * Útil para rutas que pueden ser accedidas por ambos tipos de usuarios
 */
export async function protectUserOrAdminRoute(req: FastifyRequest, reply: FastifyReply) {
    // Intentar autenticación de ADMIN primero (cookies)
    const adminToken = req.cookies?.adminToken
    if (adminToken) {
        try {
            const payload = req.server.jwt.verify(adminToken) as { adminId?: number; type?: string }
            if (payload.adminId && payload.type === 'admin') {
                const admin = await findAdminById(payload.adminId)
                if (admin) {
                    ;(req as any).admin = admin
                    ;(req as any).authType = 'admin' // Para saber qué tipo de usuario es
                    return // Autenticación exitosa como admin
                }
            }
        } catch {
            // Si falla, continuar intentando con user
        }
    }

    // Intentar autenticación de USER (Bearer token)
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7)
            const payload = req.server.jwt.verify(token) as { userId?: number; type?: string }
            
            if (payload.userId && payload.type === 'user') {
                const user = await findUserById(payload.userId)
                if (user) {
                    ;(req as any).user = user
                    ;(req as any).authType = 'user' // Para saber qué tipo de usuario es
                    return // Autenticación exitosa como user
                }
            }
        } catch (err: any) {
            if (err.name === 'TokenExpiredError') {
                return reply.code(401).send({ 
                    message: 'Token expirado',
                    code: 'TOKEN_EXPIRED'
                })
            }
        }
    }

    // Si llegamos aquí, ninguna autenticación funcionó
    return reply.code(401).send({ 
        message: 'No autorizado. Debe autenticarse como admin o usuario' 
    })
}