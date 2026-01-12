import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { protectAdminRoute } from '../middlewares/authMiddleware.js'
import {
    listAdmins,
    getMyAdminProfile,
    getAdminById,
    createNewAdmin,
    updateAdminProfile,
    deleteAdmin
} from '../controllers/adminController.js'

// Middleware: solo el dueño del perfil puede acceder
async function onlyAdminOwner(req: FastifyRequest, reply: FastifyReply) {
    const admin = (req as any).admin
    const { id } = req.params as { id: string }
    const isOwner = admin?.id === Number(id)
    
    if (!isOwner) {
        return reply.code(403).send({ message: 'Solo puedes modificar tu propio perfil' })
    }
}

export default async function adminRoutes(app: FastifyInstance) {
    // Todas requieren autenticación de admin
    app.addHook('preHandler', protectAdminRoute)

    // GET /admins - Listar todos los admins (cualquier admin puede ver)
    app.get('/', listAdmins)

    // GET /admins/me - Mi perfil de admin
    app.get('/me', getMyAdminProfile)

    // GET /admins/:id - Ver perfil de otro admin (cualquier admin puede ver)
    app.get('/:id', getAdminById)

    // POST /admins - Crear nuevo admin (cualquier admin puede crear otro)
    app.post('/', createNewAdmin)

    // PATCH /admins/:id - Actualizar perfil (solo el dueño)
    app.patch('/:id', { preHandler: onlyAdminOwner }, updateAdminProfile)

    // DELETE /admins/:id - Eliminar admin (solo el dueño puede eliminarse a sí mismo)
    app.delete('/:id', { preHandler: onlyAdminOwner }, deleteAdmin)
}