import 'dotenv/config'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'

import healthDb from './routes/healthDb.js'
import authRoutes from './routes/authRoutes.js'
import userAuthRoutes from './routes/userAuthRoutes.js'
import userTypesRoutes from './routes/userTypeRoutes.js'
import usersRoutes from './routes/userRoutes.js'
import postRoutes from './routes/postRoutes.js'

import firebaseAdmin from './plugins/firebaseAdmin.js'
import adminRoutes from './routes/adminRoutes.js'


const isProd = process.env.NODE_ENV === 'production'

const app = Fastify({
    logger: isProd
        ? true
        : {
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'SYS:standard',
                    colorize: true,
                    singleLine: true
                }
            }
        }
})

await app.register(cors, {
    origin: true,
    credentials: true
})

// cookies primero
await app.register(cookie)

// jwt integrado
await app.register(jwt, {
    secret: process.env.JWT_SECRET as string,
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
    cookie: {
        cookieName: 'token', // nombre de la cookie con el access token
        signed: false
    }
})

// helper para proteger rutas
app.decorate(
    'authenticate',
    async function (req: any, reply: any) {
        try {
            await req.jwtVerify()
        } catch (err) {
            reply.code(401).send({ message: 'Token inválido o ausente' })
        }
    }
)
// firebase
await app.register(firebaseAdmin)

// rutas
app.get('/health', async () => ({ status: 'ok' }))
await app.register(authRoutes, { prefix: '/auth' })           // Admins
await app.register(userAuthRoutes, { prefix: '/user-auth' })  // Users móvil
await app.register(healthDb, { prefix: '/health' })
await app.register(adminRoutes, { prefix: '/api/admins' })  // Gestión de admins
await app.register(usersRoutes, { prefix: '/api/users' })  // Gestión de usuarios
await app.register(userTypesRoutes, { prefix: '/api/user-types' })
await app.register(postRoutes, { prefix: '/api/posts' })

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'

try {
    await app.listen({ port, host })
    app.log.info(`Servidor escuchando en http://${host}:${port}`)
} catch (err) {
    app.log.error(err)
    process.exit(1)
}
