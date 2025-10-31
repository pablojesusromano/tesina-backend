import type { FastifyInstance } from 'fastify'
import {
    registerAdmin,
    loginAdmin,
    refreshAdminToken,
    logoutAdmin
} from '../controllers/authController'
import { protectAdminRoute } from '../middlewares/authMiddleware'

export default async function authRoutes(app: FastifyInstance) {
    // Registro de admin (proteger en producción)
    app.post('/register', registerAdmin)

    // Login de admin
    app.post('/login', loginAdmin)

    // Refresh token
    app.post('/refresh-token', refreshAdminToken)

    // Logout
    app.post('/logout', { preHandler: protectAdminRoute }, logoutAdmin)
}