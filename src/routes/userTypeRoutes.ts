import type { FastifyInstance } from 'fastify'
import {
    getUserTypes,
    getCommonTypes,
    getUserTypeById,
    createNewUserType,
    updateUserTypeById,
    deleteUserTypeById
} from '../controllers/userTypeController.js'
import { protectAdminRoute } from '../middlewares/authMiddleware.js'
import { validateUserType, validateIdParam } from '../middlewares/validateMiddleware.js'

export default async function userTypesRoutes(app: FastifyInstance) {
    // ============================================
    // RUTAS PÚBLICAS (sin autenticación)
    // Para que usuarios NO autenticados puedan ver tipos al registrarse
    // ============================================

    // GET /user-types - Listar todos los tipos (PÚBLICO)
    app.get('/', getUserTypes)
    // GET /user-types/common - Obtener tipos comunes (PÚBLICO)
    app.get('/common', getCommonTypes)
    // GET /user-types/:id - Obtener tipo por ID (PÚBLICO)
    app.get('/:id', { preHandler: validateIdParam }, getUserTypeById)

    // ============================================
    // RUTAS DE GESTIÓN (solo admins del sistema)
    // ============================================

    // POST /user-types/admin - Crear tipo (SOLO ADMIN)
    app.post('/admin', {
        preHandler: [protectAdminRoute, validateUserType]
    }, createNewUserType)
    // PUT /user-types/admin/:id - Actualizar tipo (SOLO ADMIN)
    app.put('/admin/:id', {
        preHandler: [protectAdminRoute, validateIdParam, validateUserType]
    }, updateUserTypeById)
    // DELETE /user-types/admin/:id - Eliminar tipo (SOLO ADMIN)
    app.delete('/admin/:id', {
        preHandler: [protectAdminRoute, validateIdParam]
    }, deleteUserTypeById)
}