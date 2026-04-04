import type { FastifyInstance } from 'fastify'
import {
    listUsers,
    getMe,
    getUserById,
    updateUser,
    getRanking,
    getDiscoveredSpecies,
    getMyTimeline,
    getMyStreak,
    getStreakLeaderboard
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

    // GET /users/me/timeline - Línea de vida del usuario
    app.get('/me/timeline', getMyTimeline)

    // GET /users/me/streak - Racha de días consecutivos
    app.get('/me/streak', getMyStreak)

    // PATCH /users/me - Actualizar perfil (solo el dueño)
    app.patch('/me', updateUser)

    // GET /users/ranking - Ver ranking de usuarios
    app.get('/ranking', getRanking)

    // GET /users/streak-ranking - Ranking de rachas de días conectados
    app.get('/streak-ranking', getStreakLeaderboard)

    // GET /users/:id - Ver perfil de otro usuario (público para rankings)
    app.get('/:id', getUserById)
}