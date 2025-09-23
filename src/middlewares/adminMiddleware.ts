import type { FastifyRequest, FastifyReply } from 'fastify'

// Middleware para verificar que el usuario sea admin o super_admin
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    if (!user) {
        return reply.code(401).send({ message: 'No autorizado: usuario no encontrado' })
    }

    // Verificar que tenga role_id de admin (2) o super_admin (3)
    if (user.role_id !== 2 && user.role_id !== 3) {
        return reply.code(403).send({ message: 'Acceso denegado: se requieren permisos de administrador' })
    }
}

// Middleware para verificar que el usuario sea super admin
export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    if (!user) {
        return reply.code(401).send({ message: 'No autorizado: usuario no encontrado' })
    }

    // Verificar que tenga role_id de super_admin (3)
    if (user.role_id !== 3) {
        return reply.code(403).send({ message: 'Acceso denegado: se requieren permisos de super administrador' })
    }
}

// Middleware flexible que acepta múltiples roles por ID
export function requireRoles(...allowedRoleIds: number[]) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        const user = (req as any).user
        if (!user) {
            return reply.code(401).send({ message: 'No autorizado: usuario no encontrado' })
        }

        if (!allowedRoleIds.includes(user.role_id)) {
            return reply.code(403).send({ message: 'Acceso denegado: permisos insuficientes' })
        }
    }
}