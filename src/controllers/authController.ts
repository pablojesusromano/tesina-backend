import type { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { findUserByEmailOrUsername, createUser, findUserById } from '../models/user.js'
import { findRoleById, findRoleByName } from '../models/userRole.js'
import { findUserTypeById, findUserTypeByName } from '../models/userType.js'

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
    const {
        name, email, username, password,
        roleId, roleName,
        userTypeId, userTypeName
    } = req.body as {
        name: string; email: string; username: string; password: string;
        roleId?: number | string; roleName?: string;
        userTypeId?: number | string; userTypeName?: string;
    }

    // Duplicados
    const existsByEmail = await findUserByEmailOrUsername(email)
    const existsByUsername = await findUserByEmailOrUsername(username)
    if (existsByEmail || existsByUsername) {
        return reply.code(400).send({ message: 'Email o nombre de usuario ya está en uso' })
    }

    // Resolver rol
    let roleIdResolved: number | undefined = undefined
    if (roleId != null) {
        const r = await findRoleById(Number(roleId))
        if (!r) return reply.code(400).send({ message: 'roleId inválido' })
        roleIdResolved = r.id
    } else if (roleName) {
        const r = await findRoleByName(roleName)
        if (!r) return reply.code(400).send({ message: 'roleName inválido' })
        roleIdResolved = r.id
    }

    // Resolver user type
    let userTypeIdResolved: number | undefined = undefined
    if (userTypeId != null) {
        const ut = await findUserTypeById(Number(userTypeId))
        if (!ut) return reply.code(400).send({ message: 'userTypeId inválido' })
        userTypeIdResolved = ut.id
    } else if (userTypeName) {
        const ut = await findUserTypeByName(userTypeName)
        if (!ut) return reply.code(400).send({ message: 'userTypeName inválido' })
        userTypeIdResolved = ut.id
    }

    const hashed = await bcrypt.hash(password, 10)

    try {
        const newId = await createUser(
            name,
            email,
            username,
            hashed,
            {
                ...(roleIdResolved !== undefined ? { roleId: roleIdResolved } : {}),
                ...(userTypeIdResolved !== undefined ? { userTypeId: userTypeIdResolved } : {})
            }
        )

        if (!newId) return reply.code(500).send({ message: 'Error creando usuario' })

        const access = await reply.jwtSign({ userId: newId })
        const refresh = await reply.jwtSign({ userId: newId }, { expiresIn: '7d' })

        setAccessCookie(reply, access)
        setRefreshCookie(reply, refresh)

        return reply.code(201).send({
            message: 'Usuario creado',
            user: {
                id: newId,
                email,
                username,
                roleId: roleIdResolved ?? 1,
                userTypeId: userTypeIdResolved ?? 1
            }
        })
    } catch (err: any) {
        // Mapeo amigable de MySQL
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Duplicado (email/username)' })
        }
        if (err?.code === 'ER_NO_REFERENCED_ROW_2') {
            return reply.code(400).send({ message: 'FK inválida (roleId/userTypeId)' })
        }
        return reply.code(500).send({ message: 'Error creando usuario' })
    }
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
