import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
    getRoles,
    getRoleById,
    createNewRole,
    updateRoleById,
    deleteRoleById
} from '../controllers/userRoleController.js'
import { protectRoute } from '../middlewares/authMiddleware.js'
import { requireSuperAdmin } from '../middlewares/adminMiddleware.js'
import { validateRole, validateIdParam } from '../middlewares/validateMiddleware.js'

export default async function userRolesRoutes(app: FastifyInstance) {
    // Middleware combinado para todas las rutas
    app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
        await protectRoute(req, reply)
        await requireSuperAdmin(req, reply)
    })

    app.get('/', getRoles)
    app.get('/:id', { preHandler: validateIdParam }, getRoleById)
    app.post('/', { preHandler: validateRole }, createNewRole)
    app.put('/:id', { preHandler: [validateIdParam, validateRole] }, updateRoleById)
    app.delete('/:id', { preHandler: validateIdParam }, deleteRoleById)
}