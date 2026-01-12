import type { FastifyInstance } from 'fastify'
import {
    firebaseRegister,
    firebaseLogin,
    refreshUserToken,
    logoutUser
} from '../controllers/userAuthController.js'
import { protectUserRoute } from '../middlewares/userAuthMiddleware.js'

export default async function userAuthRoutes(app: FastifyInstance) {
    // Registro con Firebase
    app.post('/register', firebaseRegister)

    // Login con Firebase
    app.post('/login', firebaseLogin)

    // Refresh token
    app.post('/refresh-token', refreshUserToken)

    // Logout
    app.post('/logout', { preHandler: protectUserRoute }, logoutUser)
}