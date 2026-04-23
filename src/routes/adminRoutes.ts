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
import { listScreenTime } from '../controllers/screenTimeController.js'

// Middleware: solo el dueño del perfil puede acceder
async function onlyAdminOwner(req: FastifyRequest, reply: FastifyReply) {
    const admin = (req as any).admin
    const { id } = req.params as { id: string }
    const isOwner = admin?.id === Number(id)

    if (!isOwner) {
        return reply.code(403).send({ message: 'Solo puedes modificar tu propio perfil' })
    }
}

// Middleware: solo super admins (pato y denis) pueden acceder
async function onlySuperAdmins(req: FastifyRequest, reply: FastifyReply) {
    const admin = (req as any).admin

    const isPato = admin?.email === 'pato@mail.com' && admin?.username === 'patoromano'
    const isDenis = admin?.email === 'denis@mail.com' && admin?.username === 'denisrybier'

    if (!isPato && !isDenis) {
        return reply.code(403).send({ message: 'No tienes permisos suficientes para realizar esta acción' })
    }
}

export default async function adminRoutes(app: FastifyInstance) {
    // Todas requieren autenticación de admin
    app.addHook('preHandler', protectAdminRoute)

    // GET /admins - Listar todos los admins (solo super admins)
    app.get('/', { preHandler: onlySuperAdmins }, listAdmins)

    // GET /admins/me - Mi perfil de admin
    app.get('/me', getMyAdminProfile)

    // GET /admins/:id - Ver perfil de otro admin (solo super admins)
    app.get('/:id', { preHandler: onlySuperAdmins }, getAdminById)

    // POST /admins - Crear nuevo admin (solo super admins)
    app.post('/', { preHandler: onlySuperAdmins }, createNewAdmin)

    // PATCH /admins/:id - Actualizar perfil (solo el dueño)
    app.patch('/:id', { preHandler: onlyAdminOwner }, updateAdminProfile)

    // DELETE /admins/:id - Eliminar admin (solo el dueño puede eliminarse a sí mismo)
    app.delete('/:id', { preHandler: onlyAdminOwner }, deleteAdmin)

    // GET /admins/screen-time - Datos de tiempo en pantalla desde Firestore (solo super admins)
    app.get('/screen-time', { preHandler: onlySuperAdmins }, listScreenTime)
}