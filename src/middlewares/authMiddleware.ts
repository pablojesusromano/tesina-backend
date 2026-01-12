import type { FastifyRequest, FastifyReply } from 'fastify'
import { findAdminById } from '../models/admin.js'

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