import type { FastifyRequest, FastifyReply } from 'fastify'
import { findUserByFirebaseUid, findUserByUsername, createUser, findUserById } from '../models/user'
import { findUserTypeByName } from '../models/userType'

const isProd = process.env.NODE_ENV === 'production'

function setUserAccessCookie(reply: FastifyReply, token: string) {
    reply.setCookie('userToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60
    })
}

function setUserRefreshCookie(reply: FastifyReply, token: string) {
    reply.setCookie('userRefreshToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60
    })
}

/** REGISTRO con Firebase */
export async function firebaseRegister(req: FastifyRequest, reply: FastifyReply) {
    const { idToken, username, name, userTypeName, image } = req.body as {
        idToken: string
        username: string
        name: string
        userTypeName?: string
        image?: string
    }

    if (!idToken || !username || !name) {
        return reply.code(400).send({
            message: 'Faltan campos: idToken, username y name son obligatorios'
        })
    }

    try {
        const decoded = await req.server.firebase.auth().verifyIdToken(idToken, true)
        const { uid, email_verified } = decoded

        if (email_verified === false) {
            return reply.code(401).send({ message: 'Email no verificado en Firebase' })
        }

        const existingByUid = await findUserByFirebaseUid(uid)
        if (existingByUid) {
            return reply.code(409).send({
                message: 'Usuario ya registrado',
                code: 'ALREADY_REGISTERED'
            })
        }

        const existingByUsername = await findUserByUsername(username)
        if (existingByUsername) {
            return reply.code(409).send({
                message: 'Username ya está en uso',
                code: 'USERNAME_EXISTS'
            })
        }

        let userTypeId: number | null = null
        if (userTypeName) {
            const ut = await findUserTypeByName(userTypeName)
            if (ut) userTypeId = ut.id
        }

        const newUserId = await createUser(uid, name, username, userTypeId, image || null)

        if (!newUserId) {
            return reply.code(500).send({ message: 'Error creando usuario' })
        }

        const access = await reply.jwtSign({ userId: newUserId, type: 'user' })
        const refresh = await reply.jwtSign({ userId: newUserId, type: 'user' }, { expiresIn: '7d' })

        setUserAccessCookie(reply, access)
        setUserRefreshCookie(reply, refresh)

        return reply.code(201).send({
            message: 'Usuario registrado con Firebase',
            user: {
                id: newUserId,
                firebase_uid: uid,
                username,
                name,
                userTypeId
            }
        })

    } catch (err: any) {
        req.server.log.error(err)

        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Username duplicado' })
        }

        return reply.code(401).send({
            message: 'Token de Firebase inválido o error en registro'
        })
    }
}

/** LOGIN con Firebase */
export async function firebaseLogin(req: FastifyRequest, reply: FastifyReply) {
    const { idToken } = req.body as { idToken: string }

    if (!idToken) {
        return reply.code(400).send({ message: 'Falta idToken' })
    }

    try {
        const decoded = await req.server.firebase.auth().verifyIdToken(idToken, true)
        const { uid, email_verified } = decoded

        if (email_verified === false) {
            return reply.code(401).send({ message: 'Email no verificado en Firebase' })
        }

        const user = await findUserByFirebaseUid(uid)

        if (!user) {
            return reply.code(404).send({
                message: 'Usuario no registrado. Usa /user-auth/register',
                code: 'NOT_REGISTERED'
            })
        }

        const access = await reply.jwtSign({ userId: user.id, type: 'user' })
        const refresh = await reply.jwtSign({ userId: user.id, type: 'user' }, { expiresIn: '7d' })

        setUserAccessCookie(reply, access)
        setUserRefreshCookie(reply, refresh)

        return reply.send({
            message: 'Login con Firebase exitoso',
            user: {
                id: user.id,
                firebase_uid: user.firebase_uid,
                username: user.username,
                name: user.name,
                image: user.image,
                user_type_id: user.user_type_id,
                points: user.points
            }
        })

    } catch (err) {
        req.server.log.error(err)
        return reply.code(401).send({ message: 'Token de Firebase inválido' })
    }
}

/** REFRESH TOKEN */
export async function refreshUserToken(req: FastifyRequest, reply: FastifyReply) {
    const rt = req.cookies?.userRefreshToken
    if (!rt) {
        return reply.code(401).send({ message: 'Falta refresh token' })
    }

    try {
        const payload = req.server.jwt.verify(rt) as { userId?: number; type?: string }
        const userId = payload?.userId

        if (!userId || payload.type !== 'user') {
            return reply.code(401).send({ message: 'Refresh token inválido' })
        }

        const user = await findUserById(userId)
        if (!user) {
            return reply.code(401).send({ message: 'Usuario no encontrado' })
        }

        const newAccess = await reply.jwtSign({ userId, type: 'user' })
        const newRefresh = await reply.jwtSign({ userId, type: 'user' }, { expiresIn: '7d' })

        setUserAccessCookie(reply, newAccess)
        setUserRefreshCookie(reply, newRefresh)

        return reply.send({ message: 'Token renovado' })
    } catch {
        return reply.code(403).send({ message: 'Refresh token inválido' })
    }
}

/** LOGOUT */
export async function logoutUser(_req: FastifyRequest, reply: FastifyReply) {
    reply.clearCookie('userToken', { path: '/' })
    reply.clearCookie('userRefreshToken', { path: '/' })
    return reply.send({ message: 'Sesión cerrada' })
}