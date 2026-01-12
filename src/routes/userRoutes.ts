import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { protectUserRoute } from '../middlewares/userAuthMiddleware.js'
import {
    listUsers,
    getMe,
    getUserById,
    updateUser
} from '../controllers/userController.js'

// Middleware: solo el dueño del perfil puede acceder
async function onlyOwner(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }
    const isOwner = user?.id === Number(id)
    
    if (!isOwner) {
        return reply.code(403).send({ message: 'Acceso denegado' })
    }
}

export default async function usersRoutes(app: FastifyInstance) {
    // Todas requieren autenticación de user móvil
    app.addHook('preHandler', protectUserRoute)

    // GET /users - Listar usuarios (público para users autenticados - para rankings, etc)
    app.get('/', listUsers)

    // GET /users/me - Mi perfil
    app.get('/me', getMe)

    // GET /users/:id - Ver perfil de otro usuario (público para rankings)
    app.get('/:id', getUserById)

    // PATCH /users/:id - Actualizar perfil (solo el dueño)
    app.patch('/:id', { preHandler: onlyOwner }, updateUser)
}