
import type { FastifyInstance } from 'fastify'
import {
    getUserTypes,
    getCommonTypes,
    getUserTypeById,
    createNewUserType,
    updateUserTypeById,
    deleteUserTypeById
} from '../controllers/userTypeController.js'
import { protectRoute } from '../middlewares/authMiddleware.js'
import { requireAdmin, requireSuperAdmin } from '../middlewares/adminMiddleware.js'
import { validateUserType, validateIdParam } from '../middlewares/validateMiddleware.js'

export default async function userTypesRoutes(app: FastifyInstance) {
    // Todas las rutas requieren autenticación
    app.addHook('preHandler', protectRoute)

    // Rutas públicas (para usuarios autenticados)
    app.get('/', getUserTypes)
    app.get('/common', getCommonTypes)
    app.get('/:id', { preHandler: validateIdParam }, getUserTypeById)

    // Rutas de gestión (admin+)
    app.post('/', { preHandler: [validateUserType, requireAdmin] }, createNewUserType)
    app.put('/:id', { preHandler: [validateIdParam, validateUserType, requireAdmin] }, updateUserTypeById)
    
    // Solo super admin puede eliminar
    app.delete('/:id', { preHandler: [validateIdParam, requireSuperAdmin] }, deleteUserTypeById)
}