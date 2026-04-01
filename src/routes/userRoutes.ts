import type { FastifyInstance } from 'fastify'
import {
    listUsers,
    getMe,
    getUserById,
    updateUser,
    getRanking,
    getDiscoveredSpecies
} from '../controllers/userController.js'
import { protectUserRoute } from '../middlewares/userAuthMiddleware.js'

export default async function usersRoutes(app: FastifyInstance) {
    // Todas requieren autenticación de user móvil
    app.addHook('preHandler', protectUserRoute)

    // GET /users - Listar usuarios (público para users autenticados - para rankings, etc)
    app.get('/', listUsers)

    // GET /users/me - Mi perfil
    app.get('/me', getMe)

    // GET /users/me/discovered-species - Ver especies descubiertas por el usuario logeado
    app.get('/me/discovered-species', getDiscoveredSpecies)

    // PATCH /users/:id - Actualizar perfil (solo el dueño)
    app.patch('/me', updateUser)

    // GET /users/ranking - Ver ranking de usuarios
    app.get('/ranking', getRanking)

    // GET /users/:id - Ver perfil de otro usuario (público para rankings)
    app.get('/:id', getUserById)
}