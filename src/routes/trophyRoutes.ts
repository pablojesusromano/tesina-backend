import type { FastifyInstance } from 'fastify'
import { listAllTrophies, getMyTrophies } from '../controllers/trophyController.js'
import { protectUserRoute } from '../middlewares/userAuthMiddleware.js'
import { protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'

export default async function trophyRoutes(app: FastifyInstance) {
    app.get('/', { preHandler: protectUserOrAdminRoute }, listAllTrophies)
    
    app.get('/me', { preHandler: protectUserRoute }, getMyTrophies)
}
