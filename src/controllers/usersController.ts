import type { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { findUserById, findUserByEmailOrUsername } from '../models/user.js'
import { findRoleById } from '../models/userRole.js'
import { findUserTypeById } from '../models/userType.js'
import type { DBUser } from '../models/user.js'

function sanitizeUser(u: DBUser) {
    // Ocultá sólo lo sensible; podés agregar google_id/facebook_id si querés
    const { password_hash, ...safe } = u
    return safe
}

/** GET /users (admin/super_admin) ?page=1&pageSize=20 */
export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
    const page = Math.max(1, Number((req.query as any)?.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize ?? 20)))
    const offset = (page - 1) * pageSize

    const [rows] = await pool.query<(RowDataPacket & {
        id: number; email: string; username: string; name: string | null; image: string | null;
        role_id: number; user_type_id: number; points: number; created_at: Date; updated_at: Date | null
    })[]>(`SELECT id, email, username, name, image, role_id, user_type_id, points, created_at, updated_at
          FROM users
          ORDER BY id ASC
          LIMIT ? OFFSET ?`, [pageSize, offset])

    const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM users'
    )
    const total = Number((countRows as any)[0].total)

    return reply.send({
        page, pageSize, total, data: rows
    })
}

/** GET /users/me (autenticado) */
export async function getMe(req: FastifyRequest, reply: FastifyReply) {
    const me = (req as any).authUser
    return reply.send(sanitizeUser(me))
}

/** GET /users/:id (dueño o admin) */
export async function getUserByIdCtrl(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userId = Number(id)

    const auth = (req as any).authUser
    const isOwner = auth?.id === userId
    const isAdmin = Number(auth?.role_id) === 2 || Number(auth?.role_id) === 3
    if (!isOwner && !isAdmin) {
        return reply.code(403).send({ message: 'Acceso denegado' })
    }

    const user = await findUserById(userId)
    if (!user) return reply.code(404).send({ message: 'Usuario no encontrado' })
    return reply.send(sanitizeUser(user))
}

/** POST /users (admin/super_admin) */
export async function createUserCtrl(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).authUser
    const isAdmin = Number(auth?.role_id) === 2 || Number(auth?.role_id) === 3
    if (!isAdmin) return reply.code(403).send({ message: 'Acceso denegado' })

    const { name, email, username, password, roleId, userTypeId, image } = (req.body as any) ?? {}

    if (!email || !username || !password) {
        return reply.code(400).send({ message: 'email, username y password son obligatorios' })
    }

    // Ver duplicados
    const dup = await findUserByEmailOrUsername(email) || await findUserByEmailOrUsername(username)
    if (dup) return reply.code(409).send({ message: 'Email o nombre de usuario ya registrados' })

    // Validar FKs si llegan
    let roleIdResolved: number | undefined
    if (roleId != null) {
        const r = await findRoleById(Number(roleId))
        if (!r) return reply.code(400).send({ message: 'roleId inválido' })
        roleIdResolved = r.id
    }
    let userTypeIdResolved: number | undefined
    if (userTypeId != null) {
        const ut = await findUserTypeById(Number(userTypeId))
        if (!ut) return reply.code(400).send({ message: 'userTypeId inválido' })
        userTypeIdResolved = ut.id
    }

    const hashed = await bcrypt.hash(String(password), 10)

    const [res] = await pool.execute<ResultSetHeader>(
        `INSERT INTO users (email, username, password_hash, name, image, role_id, user_type_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [email, username, hashed, name ?? null, image ?? null, roleIdResolved ?? 1, userTypeIdResolved ?? 1]
    )

    return reply.code(201).send({
        message: 'Usuario creado',
        user: { id: res.insertId, email, username, name: name ?? null, image: image ?? null, role_id: roleIdResolved ?? 1, user_type_id: userTypeIdResolved ?? 1 }
    })
}

/** PATCH /users/:id (dueño o admin)
 *  - Dueño puede cambiar: name, username, image, password
 *  - Admin además puede cambiar: role_id, user_type_id, points
 */
export async function updateUserCtrl(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userId = Number(id)

    const auth = (req as any).authUser
    const isOwner = auth?.id === userId
    const isAdmin = Number(auth?.role_id) === 2 || Number(auth?.role_id) === 3
    if (!isOwner && !isAdmin) return reply.code(403).send({ message: 'Acceso denegado' })

    const body = (req.body as any) ?? {}
    const fields: string[] = []
    const params: any[] = []

    // dueño/admin: datos de perfil
    if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name || null) }
    if (body.username !== undefined) { fields.push('username = ?'); params.push(body.username) }
    if (body.image !== undefined) { fields.push('image = ?'); params.push(body.image || null) }
    if (body.password !== undefined) {
        const hashed = await bcrypt.hash(String(body.password), 10)
        fields.push('password_hash = ?'); params.push(hashed)
    }

    // solo admin: rol/tipo/puntos
    if (isAdmin) {
        if (body.roleId !== undefined) {
            const r = await findRoleById(Number(body.roleId))
            if (!r) return reply.code(400).send({ message: 'roleId inválido' })
            fields.push('role_id = ?'); params.push(r.id)
        }
        if (body.userTypeId !== undefined) {
            const ut = await findUserTypeById(Number(body.userTypeId))
            if (!ut) return reply.code(400).send({ message: 'userTypeId inválido' })
            fields.push('user_type_id = ?'); params.push(ut.id)
        }
        if (body.points !== undefined) {
            const pts = Math.max(0, Number(body.points) || 0)
            fields.push('points = ?'); params.push(pts)
        }
    }

    if (fields.length === 0) return reply.code(400).send({ message: 'Nada para actualizar' })

    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`
    params.push(userId)

    try {
        await pool.execute(sql, params)
        const updated = await findUserById(userId)
        return reply.send({ message: 'Usuario actualizado', user: updated })
    } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Email o username ya en uso' })
        }
        return reply.code(500).send({ message: 'Error actualizando usuario' })
    }
}

/** DELETE /users/:id (super_admin) */
export async function deleteUserCtrl(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).authUser
    const isSuper = Number(auth?.role_id) === 3
    if (!isSuper) return reply.code(403).send({ message: 'Acceso denegado: se requieren permisos de super administrador' })

    const { id } = req.params as { id: string }
    const userId = Number(id)

    const [res] = await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId])
    if (res.affectedRows === 0) return reply.code(404).send({ message: 'Usuario no encontrado' })

    return reply.send({ message: 'Usuario eliminado' })
}
