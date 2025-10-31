import type { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { findAdminByEmailOrUsername, createAdmin, findAdminById } from '../models/admin'

const isProd = process.env.NODE_ENV === 'production'

function setAccessCookie(reply: FastifyReply, token: string) {
    reply.setCookie('adminToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 // 15 min
    })
}

function setRefreshCookie(reply: FastifyReply, token: string) {
    reply.setCookie('adminRefreshToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 días
    })
}

// REGISTRO de admin (solo para crear el primer admin o desde otro admin)
export async function registerAdmin(req: FastifyRequest, reply: FastifyReply) {
    const { email, username, password, name, image } = req.body as {
        email: string
        username: string
        password: string
        name: string
        image?: string
    }

    const existsByEmail = await findAdminByEmailOrUsername(email)
    const existsByUsername = await findAdminByEmailOrUsername(username)
    
    if (existsByEmail || existsByUsername) {
        return reply.code(400).send({ message: 'Email o username ya existe' })
    }

    const hashed = await bcrypt.hash(password, 10)

    try {
        const newId = await createAdmin(email, username, hashed, name, image)
        
        if (!newId) {
            return reply.code(500).send({ message: 'Error creando admin' })
        }

        const access = await reply.jwtSign({ adminId: newId, type: 'admin' })
        const refresh = await reply.jwtSign({ adminId: newId, type: 'admin' }, { expiresIn: '7d' })

        setAccessCookie(reply, access)
        setRefreshCookie(reply, refresh)

        return reply.code(201).send({
            message: 'Admin creado',
            admin: { id: newId, email, username, name }
        })
    } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Email o username duplicado' })
        }
        return reply.code(500).send({ message: 'Error creando admin' })
    }
}

// LOGIN de admin
export async function loginAdmin(req: FastifyRequest, reply: FastifyReply) {
    const { email, username, password } = req.body as {
        email?: string
        username?: string
        password: string
    }

    const identifier = email ?? username
    if (!identifier) {
        return reply.code(400).send({ message: 'Debes enviar email o username' })
    }

    const admin = await findAdminByEmailOrUsername(identifier)
    if (!admin) {
        return reply.code(400).send({ message: 'Credenciales inválidas' })
    }

    const ok = await bcrypt.compare(password, admin.password_hash)
    if (!ok) {
        return reply.code(400).send({ message: 'Credenciales inválidas' })
    }

    const access = await reply.jwtSign({ adminId: admin.id, type: 'admin' })
    const refresh = await reply.jwtSign({ adminId: admin.id, type: 'admin' }, { expiresIn: '7d' })

    setAccessCookie(reply, access)
    setRefreshCookie(reply, refresh)

    return reply.send({
        message: 'Login correcto',
        admin: {
            id: admin.id,
            email: admin.email,
            username: admin.username,
            name: admin.name,
            image: admin.image
        }
    })
}

// REFRESH TOKEN de admin
export async function refreshAdminToken(req: FastifyRequest, reply: FastifyReply) {
    const rt = req.cookies?.adminRefreshToken
    if (!rt) {
        return reply.code(401).send({ message: 'Falta refresh token' })
    }

    try {
        const payload = req.server.jwt.verify(rt) as { adminId?: number; type?: string }
        const adminId = payload?.adminId
        
        if (!adminId || payload.type !== 'admin') {
            return reply.code(401).send({ message: 'Refresh token inválido' })
        }

        const admin = await findAdminById(adminId)
        if (!admin) {
            return reply.code(401).send({ message: 'Admin no encontrado' })
        }

        const newAccess = await reply.jwtSign({ adminId, type: 'admin' })
        const newRefresh = await reply.jwtSign({ adminId, type: 'admin' }, { expiresIn: '7d' })

        setAccessCookie(reply, newAccess)
        setRefreshCookie(reply, newRefresh)

        return reply.send({ message: 'Token renovado' })
    } catch {
        return reply.code(403).send({ message: 'Refresh token inválido' })
    }
}

// LOGOUT de admin
export async function logoutAdmin(_req: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie('adminToken', { path: '/' })
    reply.clearCookie('adminRefreshToken', { path: '/' })
    return reply.send({ message: 'Sesión cerrada' })
}