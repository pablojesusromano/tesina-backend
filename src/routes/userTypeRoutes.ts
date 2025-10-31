import type { FastifyInstance } from 'fastify'
import {
    getUserTypes,
    getCommonTypes,
    getUserTypeById,
    createNewUserType,
    updateUserTypeById,
    deleteUserTypeById
} from '../controllers/userTypeController'
import { protectUserRoute } from '../middlewares/userAuthMiddleware'
import { protectAdminRoute } from '../middlewares/authMiddleware'
import { validateUserType, validateIdParam } from '../middlewares/validateMiddleware'

export default async function userTypesRoutes(app: FastifyInstance) {
    // Rutas públicas para users de la app móvil (autenticados)
    app.get('/', { preHandler: protectUserRoute }, getUserTypes)
    app.get('/common', { preHandler: protectUserRoute }, getCommonTypes)
    app.get('/:id', {
        preHandler: [validateIdParam, protectUserRoute]
    }, getUserTypeById)

    // Rutas de gestión (solo admins del sistema de gestión)
    app.post('/admin', {
        preHandler: [protectAdminRoute, validateUserType]
    }, createNewUserType)

    app.put('/admin/:id', {
        preHandler: [protectAdminRoute, validateIdParam, validateUserType]
    }, updateUserTypeById)

    app.delete('/admin/:id', {
        preHandler: [protectAdminRoute, validateIdParam]
    }, deleteUserTypeById)
}