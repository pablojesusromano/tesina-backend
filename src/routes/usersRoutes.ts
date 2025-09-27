import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { protectRoute } from '../middlewares/authMiddleware.js'
import { requireSuperAdmin } from '../middlewares/adminMiddleware.js'
import {
    listUsers,
    getMe,
    getUserByIdCtrl,
    createUserCtrl,
    updateUserCtrl,
    deleteUserCtrl
} from '../controllers/usersController.js'

// middleware: dueño o admin para /users/:id
async function ownerOrAdmin(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).authUser
    const { id } = req.params as { id: string }
    const isOwner = auth?.id === Number(id)
    const isAdmin = Number(auth?.role_id) === 2 || Number(auth?.role_id) === 3
    if (!isOwner && !isAdmin) {
        return reply.code(403).send({ message: 'Acceso denegado' })
    }
}

export default async function usersRoutes(app: FastifyInstance) {
    // Todas requieren estar autenticado
    app.addHook('preHandler', protectRoute)

    // GET /users (admin/super_admin)
    app.get('/', async (req, reply) => {
        const auth = (req as any).authUser
        const isAdmin = Number(auth?.role_id) === 2 || Number(auth?.role_id) === 3
        if (!isAdmin) return reply.code(403).send({ message: 'Acceso denegado' })
        return listUsers(req, reply)
    })

    // GET /users/me (autenticado)
    app.get('/me', getMe)

    // GET /users/:id (dueño o admin)
    app.get('/:id', { preHandler: ownerOrAdmin }, getUserByIdCtrl)

    // POST /users (admin/super_admin)
    app.post('/', async (req, reply) => {
        const auth = (req as any).authUser
        const isAdmin = Number(auth?.role_id) === 2 || Number(auth?.role_id) === 3
        if (!isAdmin) return reply.code(403).send({ message: 'Acceso denegado' })
        return createUserCtrl(req, reply)
    })

    // PATCH /users/:id (dueño o admin)
    app.patch('/:id', { preHandler: ownerOrAdmin }, updateUserCtrl)

    // DELETE /users/:id (super_admin)
    app.delete('/:id', { preHandler: requireSuperAdmin }, deleteUserCtrl)
}
