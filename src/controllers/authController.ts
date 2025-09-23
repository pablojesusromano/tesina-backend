import type { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { findUserByEmailOrUsername, createUser, findUserById } from '../models/user.js'

const isProd = process.env.NODE_ENV === 'production'

// Helpers para setear cookies
function setAccessCookie(reply: FastifyReply, token: string) {
    reply.setCookie('token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 // 15 min
    })
}
function setRefreshCookie(reply: FastifyReply, token: string) {
    reply.setCookie('refreshToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 días
    })
}

export async function register(req: FastifyRequest, reply: FastifyReply) {
    // @ts-ignore (validado por Zod)
    const { name, email, username, password } = req.body as {
        name: string; email: string; username: string; password: string
    }

    // Evitar duplicados (email o username)
    const existsByEmail = await findUserByEmailOrUsername(email)
    const existsByUsername = await findUserByEmailOrUsername(username)
    if (existsByEmail || existsByUsername) {
        return reply.code(400).send({ message: 'Email o nombre de usuario ya está en uso' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const userId = await createUser(name, '', email, username, hashed)
    if (!userId) return reply.code(500).send({ message: 'Error creando usuario' })

    // Access (15m) y Refresh (7d)
    const access = await reply.jwtSign({ userId })
    const refresh = await reply.jwtSign({ userId }, { expiresIn: '7d' })

    setAccessCookie(reply, access)
    setRefreshCookie(reply, refresh)

    return reply.code(201).send({ message: 'Usuario creado', token: access })
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
    // @ts-ignore (validado por Zod)
    const { email, username, password } = req.body as { email?: string; username?: string; password: string }

    const identifier = email ?? username
    if (!identifier) return reply.code(400).send({ message: 'Debes enviar email o nombre de usuario' })

    const user = await findUserByEmailOrUsername(identifier)
    if (!user || !user.password_hash) return reply.code(400).send({ message: 'Credenciales inválidas' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return reply.code(400).send({ message: 'Credenciales inválidas' })

    // Access (15m) y Refresh (7d)
    const access = await reply.jwtSign({ userId: user.id })
    const refresh = await reply.jwtSign({ userId: user.id }, { expiresIn: '7d' })

    setAccessCookie(reply, access)
    setRefreshCookie(reply, refresh)

    return reply.send({
        message: 'Login correcto',
        user: { id: user.id, email: user.email, username: user.username }
    })
}

export async function refreshToken(req: FastifyRequest, reply: FastifyReply) {
    const rt = req.cookies?.refreshToken
    if (!rt) return reply.code(401).send({ message: 'Falta refresh token' })

    try {
        // Verificamos el refresh token manualmente
        const payload = req.server.jwt.verify(rt) as { userId?: number }
        const userId = payload?.userId
        if (!userId) return reply.code(401).send({ message: 'Refresh token inválido' })

        const user = await findUserById(userId)
        if (!user) return reply.code(401).send({ message: 'Usuario no encontrado' })

        // Rotación: nuevo access y nuevo refresh
        const newAccess = await reply.jwtSign({ userId })
        const newRefresh = await reply.jwtSign({ userId }, { expiresIn: '7d' })

        setAccessCookie(reply, newAccess)
        setRefreshCookie(reply, newRefresh)

        return reply.send({ message: 'Token renovado' })
    } catch {
        return reply.code(403).send({ message: 'Refresh token inválido' })
    }
}

export async function logout(_req: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie('token', { path: '/' })
    reply.clearCookie('refreshToken', { path: '/' })
    return reply.send({ message: 'Sesión cerrada' })
}
