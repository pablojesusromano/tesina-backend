import type { FastifyRequest, FastifyReply } from 'fastify'
import { findUserByFirebaseUid, findUserByUsername, createUser, findUserById } from '../models/user'
import { findUserTypeByName } from '../models/userType'

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
        // 1. Verificar idToken de Firebase
        const decoded = await req.server.firebase.auth().verifyIdToken(idToken, true)
        const { uid, email_verified } = decoded

        if (email_verified === false) {
            return reply.code(401).send({ message: 'Email no verificado en Firebase' })
        }

        // 2. Verificar si ya existe el usuario
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

        // 3. Obtener userType si se proporciona
        let userTypeId: number | null = null
        if (userTypeName) {
            const ut = await findUserTypeByName(userTypeName)
            if (ut) userTypeId = ut.id
        }

        // 4. Crear usuario en la base de datos
        const newUserId = await createUser(uid, name, username, userTypeId, image || null)

        if (!newUserId) {
            return reply.code(500).send({ message: 'Error creando usuario' })
        }

        // 5. Generar tokens JWT propios (NO cookies, solo tokens en body)
        const accessToken = await reply.jwtSign(
            { userId: newUserId, type: 'user' },
            { expiresIn: '15m' }
        )
        const refreshToken = await reply.jwtSign(
            { userId: newUserId, type: 'user' },
            { expiresIn: '7d' }
        )

        // 6. Devolver tokens en el body para que Flutter los guarde
        return reply.code(201).send({
            message: 'Usuario registrado exitosamente',
            accessToken,
            refreshToken,
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
        // 1. Verificar idToken de Firebase
        const decoded = await req.server.firebase.auth().verifyIdToken(idToken, true)
        const { uid, email_verified } = decoded

        if (email_verified === false) {
            return reply.code(401).send({ message: 'Email no verificado en Firebase' })
        }

        // 2. Buscar usuario en la base de datos
        const user = await findUserByFirebaseUid(uid)

        if (!user) {
            return reply.code(404).send({
                message: 'Usuario no registrado. Usa /user-auth/register',
                code: 'NOT_REGISTERED'
            })
        }

        // 3. Generar tokens JWT propios
        const accessToken = await reply.jwtSign(
            { userId: user.id, type: 'user' },
            { expiresIn: '15m' }
        )
        const refreshToken = await reply.jwtSign(
            { userId: user.id, type: 'user' },
            { expiresIn: '7d' }
        )

        // 4. Devolver tokens en el body
        return reply.send({
            message: 'Login exitoso',
            accessToken,
            refreshToken,
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
    const { refreshToken } = req.body as { refreshToken?: string }
    
    if (!refreshToken) {
        return reply.code(401).send({ message: 'Falta refresh token' })
    }

    try {
        const payload = req.server.jwt.verify(refreshToken) as { userId?: number; type?: string }
        const userId = payload?.userId

        if (!userId || payload.type !== 'user') {
            return reply.code(401).send({ message: 'Refresh token inválido' })
        }

        const user = await findUserById(userId)
        if (!user) {
            return reply.code(401).send({ message: 'Usuario no encontrado' })
        }

        // Generar nuevos tokens
        const newAccessToken = await reply.jwtSign(
            { userId, type: 'user' },
            { expiresIn: '15m' }
        )
        const newRefreshToken = await reply.jwtSign(
            { userId, type: 'user' },
            { expiresIn: '7d' }
        )

        return reply.send({
            message: 'Token renovado',
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        })
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return reply.code(403).send({ 
                message: 'Refresh token expirado',
                code: 'REFRESH_TOKEN_EXPIRED'
            })
        }
        return reply.code(403).send({ message: 'Refresh token inválido' })
    }
}

/** LOGOUT */
export async function logoutUser(_req: FastifyRequest, reply: FastifyReply) {
    // Para móvil con JWT stateless, el logout es solo del lado del cliente
    // El cliente debe eliminar los tokens de su almacenamiento seguro
    return reply.send({ message: 'Sesión cerrada' })
}