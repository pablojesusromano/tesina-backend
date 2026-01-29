import type { FastifyInstance } from 'fastify'
import { protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'
import {
    listUsers,
    getMe,
    getUserById,
    updateUser
} from '../controllers/userController.js'

export default async function usersRoutes(app: FastifyInstance) {
    // Todas requieren autenticación de user móvil
    app.addHook('preHandler', protectUserOrAdminRoute)

    // GET /users - Listar usuarios (público para users autenticados - para rankings, etc)
    app.get('/', listUsers)

    // GET /users/me - Mi perfil
    app.get('/me', getMe)

    // GET /users/:id - Ver perfil de otro usuario (público para rankings)
    app.get('/:id', getUserById)

    // PATCH /users/:id - Actualizar perfil (solo el dueño)
    app.patch('/me', updateUser)
}