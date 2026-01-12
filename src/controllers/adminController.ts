import type { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import {
    findAdminById,
    findAdminByEmail,
    findAdminByUsername,
    createAdmin,
    updateAdmin,
    deleteAdmin as deleteAdminModel
} from '../models/admin.js'
import type { Admin } from '../models/admin.js'

function sanitizeAdmin(admin: Admin) {
    const { password_hash, ...safe } = admin
    return safe
}

/** GET /admins - Listar todos los administradores */
export async function listAdmins(req: FastifyRequest, reply: FastifyReply) {
    const page = Math.max(1, Number((req.query as any)?.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize ?? 20)))
    const offset = (page - 1) * pageSize

    const [rows] = await pool.query<(RowDataPacket & Omit<Admin, 'password_hash'>)[]>(
        `SELECT id, email, username, name, image, created_at, updated_at
         FROM admins
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [pageSize, offset]
    )

    const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM admins'
    )
    const total = Number((countRows as any)[0].total)

    return reply.send({
        page,
        pageSize,
        total,
        data: rows
    })
}

/** GET /admins/me - Mi perfil de administrador */
export async function getMyAdminProfile(req: FastifyRequest, reply: FastifyReply) {
    const me = (req as any).admin
    return reply.send(sanitizeAdmin(me))
}

/** GET /admins/:id - Ver perfil de un administrador */
export async function getAdminById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const adminId = Number(id)

    const admin = await findAdminById(adminId)
    if (!admin) {
        return reply.code(404).send({ message: 'Administrador no encontrado' })
    }

    return reply.send(sanitizeAdmin(admin))
}

/** POST /admins - Crear nuevo administrador */
export async function createNewAdmin(req: FastifyRequest, reply: FastifyReply) {
    const { email, username, password, name, image } = req.body as {
        email: string
        username?: string
        password: string
        name?: string
        image?: string
    }

    if (!email || !password) {
        return reply.code(400).send({
            message: 'Los campos email y password son obligatorios'
        })
    }

    // Verificar duplicados
    const existsByEmail = await findAdminByEmail(email)
    if (existsByEmail) {
        return reply.code(409).send({ message: 'El email ya está registrado' })
    }

    if (username) {
        const existsByUsername = await findAdminByUsername(username)
        if (existsByUsername) {
            return reply.code(409).send({ message: 'El username ya está en uso' })
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    try {
        const newAdminId = await createAdmin(
            email,
            username || null,
            hashedPassword,
            name || null,
            image || null
        )

        if (!newAdminId) {
            return reply.code(500).send({ message: 'Error creando administrador' })
        }

        const newAdmin = await findAdminById(newAdminId)

        return reply.code(201).send({
            message: 'Administrador creado exitosamente',
            admin: sanitizeAdmin(newAdmin!)
        })
    } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Email o username duplicado' })
        }
        return reply.code(500).send({ message: 'Error creando administrador' })
    }
}

/** PATCH /admins/:id - Actualizar perfil de administrador */
export async function updateAdminProfile(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const adminId = Number(id)

    const auth = (req as any).admin

    if (auth?.id !== adminId) {
        return reply.code(403).send({ message: 'Solo puedes actualizar tu propio perfil' })
    }

    const body = req.body as {
        email?: string
        username?: string
        password?: string
        name?: string
        image?: string
    }

    const updateData: Partial<Omit<Admin, 'id' | 'created_at' | 'updated_at'>> = {}

    if (body.email !== undefined) {
        const existing = await findAdminByEmail(body.email)
        if (existing && existing.id !== adminId) {
            return reply.code(409).send({ message: 'El email ya está en uso' })
        }
        updateData.email = body.email
    }

    if (body.username !== undefined) {
        if (body.username) {
            const existing = await findAdminByUsername(body.username)
            if (existing && existing.id !== adminId) {
                return reply.code(409).send({ message: 'El username ya está en uso' })
            }
        }
        updateData.username = body.username || null
    }

    if (body.name !== undefined) {
        updateData.name = body.name || null
    }

    if (body.image !== undefined) {
        updateData.image = body.image || null
    }

    if (body.password !== undefined) {
        updateData.password_hash = await bcrypt.hash(body.password, 10)
    }

    if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ message: 'Nada para actualizar' })
    }

    try {
        const success = await updateAdmin(adminId, updateData)

        if (!success) {
            return reply.code(500).send({ message: 'Error actualizando administrador' })
        }

        const updated = await findAdminById(adminId)

        return reply.send({
            message: 'Perfil actualizado exitosamente',
            admin: sanitizeAdmin(updated!)
        })
    } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Email o username ya en uso' })
        }
        return reply.code(500).send({ message: 'Error actualizando administrador' })
    }
}

/** DELETE /admins/:id - Eliminar administrador */
export async function deleteAdmin(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const adminId = Number(id)

    const auth = (req as any).admin

    if (auth?.id !== adminId) {
        return reply.code(403).send({ message: 'Solo puedes eliminar tu propia cuenta' })
    }

    // Verificar que no sea el único admin
    const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM admins'
    )
    const totalAdmins = Number((countRows as any)[0].total)

    if (totalAdmins <= 1) {
        return reply.code(400).send({
            message: 'No puedes eliminar el único administrador del sistema'
        })
    }

    try {
        const success = await deleteAdminModel(adminId)

        if (!success) {
            return reply.code(404).send({ message: 'Administrador no encontrado' })
        }

        reply.clearCookie('adminToken', { path: '/' })
        reply.clearCookie('adminRefreshToken', { path: '/' })

        return reply.send({ message: 'Administrador eliminado exitosamente' })
    } catch (err) {
        return reply.code(500).send({ message: 'Error eliminando administrador' })
    }
}