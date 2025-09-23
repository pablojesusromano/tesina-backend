import type { FastifyInstance } from 'fastify'
import { register, login, refreshToken, logout /*, firebaseAuth */ } from '../controllers/authController'
import { validateRegister, validateLogin } from '../middlewares/validateMiddleware'
import { protectRoute } from '../middlewares/authMiddleware'

export default async function authRoutes(app: FastifyInstance) {
    app.post('/register', { preHandler: validateRegister }, register)
    app.post('/login', { preHandler: validateLogin }, login)

    // app.post('/firebase', firebaseAuth)

    app.post('/refresh-token', refreshToken)
    app.post('/logout', { preHandler: protectRoute }, logout)
}
