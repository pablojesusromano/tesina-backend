import type { FastifyInstance } from 'fastify'
import {
    createNewPost,
    listPosts,
    getPostById,
    getMyPosts,
    getUserPosts,
    updatePostById,
    updatePostStatusById,
    deletePostById,
    likePostById,
    unlikePostById,
    addCommentToPost,
    deleteCommentById,
    getMyLikedPosts,
    getCommentsByPostId,
    approvePost,
    rejectPost
} from '../controllers/postController.js'
import { protectUserOrAdminRoute, protectAdminRoute } from '../middlewares/authMiddleware.js'
import { validateUpdatePost, validateIdParam, validateUserIdParam, validateStatusUpdate } from '../middlewares/validateMiddleware.js'

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

    // GET /posts/:id/comments - Ver comentarios
    app.get('/:id/comments', { preHandler: validateIdParam }, getCommentsByPostId)

    // ==================== RUTAS DE INTERACCIÓN (LIKES & COMMENTS) ====================

    // GET /posts/:id/like - Dar like
    app.get('/:id/like', { preHandler: validateIdParam }, likePostById)

    // DELETE /posts/:id/like - Quitar like
    app.delete('/:id/like', { preHandler: validateIdParam }, unlikePostById)

    // POST /posts/:id/comments - Comentar
    app.post('/:id/comments', { preHandler: validateIdParam }, addCommentToPost)

    app.delete('/:id/comments', { preHandler: validateIdParam }, deleteCommentById)

    // ==================== RUTAS PROPIAS ====================

    // GET /posts/me - Mis publicaciones
    app.get('/me', getMyPosts)

    // GET /posts/me/likes - Mis likes
    app.get('/me/likes', getMyLikedPosts)

    // POST /posts - Crear publicación
    app.post('/', createNewPost)

    // PATCH /posts/:id - Actualizar publicación (solo el creador)
    app.patch('/:id', {
        preHandler: [validateIdParam, validateUpdatePost]
    }, updatePostById)

    // PATCH /posts/:id - Actualizar publicación (solo el creador)
    app.patch('/:id/status', {
        preHandler: [validateIdParam, validateStatusUpdate]
    }, updatePostStatusById)

    // DELETE /posts/:id - Eliminar publicación (solo el creador)
    app.delete('/:id', {
        preHandler: validateIdParam
    }, deletePostById)

    // ==================== RUTAS ADMIN SOLO ====================
    
    // POST /posts/:id/approve - Aprobar post (REVISION → ACTIVO)
    app.post('/:id/approve', {
        preHandler: [protectAdminRoute, validateIdParam]
    }, approvePost)
    
    // POST /posts/:id/reject - Rechazar post (REVISION → RECHAZADO)
    app.post('/:id/reject', {
        preHandler: [protectAdminRoute, validateIdParam]
    }, rejectPost)
}