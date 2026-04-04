import type { FastifyInstance } from 'fastify'
import { listAllTrophies, getMyTrophies, claimTrophy } from '../controllers/trophyController.js'
import { protectUserRoute } from '../middlewares/userAuthMiddleware.js'
import { protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'

export default async function trophyRoutes(app: FastifyInstance) {
    // GET /trophies - Catálogo completo de trofeos
    app.get('/', { preHandler: protectUserOrAdminRoute }, listAllTrophies)

    // GET /trophies/me - Mis trofeos con progreso
    app.get('/me', { preHandler: protectUserRoute }, getMyTrophies)

    // PATCH /trophies/:id/claim - Reclamar recompensa de un trofeo
    app.patch('/:id/claim', { preHandler: protectUserRoute }, claimTrophy)
}
