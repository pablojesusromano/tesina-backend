import type { FastifyRequest, FastifyReply } from 'fastify'
import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { findUserById, findUserByUsername, updateUser as updateUserModel } from '../models/user.js'
import { findUserTypeById } from '../models/userType.js'
import type { User } from '../models/user.js'

function sanitizeUser(u: User) {
    // Los users ya no tienen datos sensibles, pero por consistencia:
    return {
        id: u.id,
        firebase_uid: u.firebase_uid,
        name: u.name,
        username: u.username,
        image: u.image,
        user_type_id: u.user_type_id,
        points: u.points,
        created_at: u.created_at,
        updated_at: u.updated_at
    }
}

/** GET /users - Listar usuarios (público para rankings) */
export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
    const page = Math.max(1, Number((req.query as any)?.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize ?? 20)))
    const offset = (page - 1) * pageSize

    // Opcional: ordenar por puntos para rankings
    const orderBy = (req.query as any)?.orderBy === 'points' ? 'points DESC' : 'id ASC'

    const [rows] = await pool.query<(RowDataPacket & User)[]>(
        `SELECT id, firebase_uid, username, name, image, user_type_id, points, created_at, updated_at
         FROM users
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [pageSize, offset]
    )

    const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM users'
    )
    const total = Number((countRows as any)[0].total)

    return reply.send({
        page,
        pageSize,
        total,
        data: rows
    })
}

/** GET /users/me - Mi perfil */
export async function getMe(req: FastifyRequest, reply: FastifyReply) {
    const me = (req as any).user
    return reply.send(sanitizeUser(me))
}

/** GET /users/:id - Ver perfil público */
export async function getUserById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userId = Number(id)

    const user = await findUserById(userId)
    if (!user) {
        return reply.code(404).send({ message: 'Usuario no encontrado' })
    }

    return reply.send(sanitizeUser(user))
}

/** PATCH /users/:id - Actualizar perfil (solo el dueño) */
export async function updateUser(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userId = Number(id)

    const auth = (req as any).user
    
    // Solo el dueño puede actualizar
    if (auth?.id !== userId) {
        return reply.code(403).send({ message: 'Acceso denegado' })
    }

    const body = (req.body as any) ?? {}
    const updateData: Partial<User> = {}

    // Campos permitidos para actualizar
    if (body.name !== undefined) updateData.name = body.name
    if (body.username !== undefined) updateData.username = body.username
    if (body.image !== undefined) updateData.image = body.image
    if (body.userTypeId !== undefined) {
        // Validar que el userType existe
        const ut = await findUserTypeById(Number(body.userTypeId))
        if (!ut) {
            return reply.code(400).send({ message: 'userTypeId inválido' })
        }
        updateData.user_type_id = ut.id
    }

    if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ message: 'Nada para actualizar' })
    }

    try {
        const success = await updateUserModel(userId, updateData)
        
        if (!success) {
            return reply.code(500).send({ message: 'Error actualizando usuario' })
        }

        const updated = await findUserById(userId)
        return reply.send({
            message: 'Usuario actualizado',
            user: sanitizeUser(updated!)
        })
    } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Username ya en uso' })
        }
        return reply.code(500).send({ message: 'Error actualizando usuario' })
    }
}