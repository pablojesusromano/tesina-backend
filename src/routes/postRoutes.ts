// src/routes/postRoutes.ts
import type { FastifyInstance } from 'fastify'
import {
    createNewPost,
    listPosts,
    getPostById,
    getMyPosts,
    getUserPosts,
    updatePostById,
    deletePostById
} from '../controllers/postController.js'
import { protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'
import { validateCreatePost, validateUpdatePost, validateIdParam, validateUserIdParam } from '../middlewares/validateMiddleware.js'

export default async function postRoutes(app: FastifyInstance) {
    // Todas las rutas aceptan ADMINS o USERS
    app.addHook('preHandler', protectUserOrAdminRoute)

    // ==================== RUTAS PÚBLICAS (autenticadas) ====================
    
    // GET /posts - Feed de publicaciones (todas)
    app.get('/', listPosts)
    
    // GET /posts/:id - Ver publicación específica
    app.get('/:id', { preHandler: validateIdParam }, getPostById)
    
    // GET /posts/user/:userId - Ver publicaciones de un usuario
    app.get('/user/:userId', { preHandler: validateUserIdParam }, getUserPosts)

    // ==================== RUTAS PROPIAS ====================
    
    // GET /posts/me - Mis publicaciones
    app.get('/me', getMyPosts)
    
    // POST /posts - Crear publicación
    app.post('/', { preHandler: validateCreatePost }, createNewPost)
    
    // PATCH /posts/:id - Actualizar publicación (solo el creador)
    app.patch('/:id', {
        preHandler: [validateIdParam, validateUpdatePost]
    }, updatePostById)
    
    // DELETE /posts/:id - Eliminar publicación (solo el creador)
    app.delete('/:id', {
        preHandler: validateIdParam
    }, deletePostById)
}