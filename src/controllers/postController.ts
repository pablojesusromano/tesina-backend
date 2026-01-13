import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    createPost,
    getAllPosts,
    findPostById,
    getPostsByUserId,
    updatePost,
    deletePost,
    countAllPosts,
    countPostsByUserId
} from '../models/post.js'

// ==================== CREAR POST ====================
export async function createNewPost(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { title, description } = req.body as {
        title: string
        description: string
    }

    try {
        const postId = await createPost(user.id, title, description)

        if (!postId) {
            return reply.code(500).send({ message: 'Error creando publicación' })
        }

        const newPost = await findPostById(postId)

        return reply.code(201).send({
            message: 'Publicación creada exitosamente',
            post: newPost
        })
    } catch (error) {
        console.error('Error creando post:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== OBTENER TODOS LOS POSTS (FEED) ====================
export async function listPosts(req: FastifyRequest, reply: FastifyReply) {
    const { page = 1, pageSize = 20 } = req.query as {
        page?: number
        pageSize?: number
    }

    const validPage = Math.max(1, Number(page))
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
    const offset = (validPage - 1) * validPageSize

    try {
        const posts = await getAllPosts(validPageSize, offset)
        const total = await countAllPosts()

        return reply.send({
            page: validPage,
            pageSize: validPageSize,
            total,
            totalPages: Math.ceil(total / validPageSize),
            posts
        })
    } catch (error) {
        console.error('Error obteniendo posts:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== OBTENER POST POR ID ====================
export async function getPostById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const postId = Number(id)

    try {
        const post = await findPostById(postId)

        if (!post) {
            return reply.code(404).send({ message: 'Publicación no encontrada' })
        }

        return reply.send({ post })
    } catch (error) {
        console.error('Error obteniendo post:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== OBTENER MIS POSTS ====================
export async function getMyPosts(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { page = 1, pageSize = 20 } = req.query as {
        page?: number
        pageSize?: number
    }

    const validPage = Math.max(1, Number(page))
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
    const offset = (validPage - 1) * validPageSize

    try {
        const posts = await getPostsByUserId(user.id, validPageSize, offset)
        const total = await countPostsByUserId(user.id)

        return reply.send({
            page: validPage,
            pageSize: validPageSize,
            total,
            totalPages: Math.ceil(total / validPageSize),
            posts
        })
    } catch (error) {
        console.error('Error obteniendo posts del usuario:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== OBTENER POSTS DE UN USUARIO ESPECÍFICO ====================
export async function getUserPosts(req: FastifyRequest, reply: FastifyReply) {
    const { userId } = req.params as { userId: string }
    const { page = 1, pageSize = 20 } = req.query as {
        page?: number
        pageSize?: number
    }

    const validUserId = Number(userId)
    const validPage = Math.max(1, Number(page))
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
    const offset = (validPage - 1) * validPageSize

    try {
        const posts = await getPostsByUserId(validUserId, validPageSize, offset)
        const total = await countPostsByUserId(validUserId)

        return reply.send({
            page: validPage,
            pageSize: validPageSize,
            total,
            totalPages: Math.ceil(total / validPageSize),
            posts
        })
    } catch (error) {
        console.error('Error obteniendo posts del usuario:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== ACTUALIZAR POST ====================
export async function updatePostById(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }
    const postId = Number(id)

    const { title, description } = req.body as {
        title?: string
        description?: string
    }

    try {
        // Verificar que el post existe
        const post = await findPostById(postId)

        if (!post) {
            return reply.code(404).send({ message: 'Publicación no encontrada' })
        }

        // Verificar que el usuario es el creador
        if (post.user_id !== user.id) {
            return reply.code(403).send({ message: 'No tienes permiso para editar esta publicación' })
        }

        // Actualizar
        const success = await updatePost(postId, title, description)

        if (!success) {
            return reply.code(500).send({ message: 'Error actualizando publicación' })
        }

        const updatedPost = await findPostById(postId)

        return reply.send({
            message: 'Publicación actualizada exitosamente',
            post: updatedPost
        })
    } catch (error) {
        console.error('Error actualizando post:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== ELIMINAR POST ====================
export async function deletePostById(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }
    const postId = Number(id)

    try {
        // Verificar que el post existe
        const post = await findPostById(postId)

        if (!post) {
            return reply.code(404).send({ message: 'Publicación no encontrada' })
        }

        // Verificar que el usuario es el creador
        if (post.user_id !== user.id) {
            return reply.code(403).send({ message: 'No tienes permiso para eliminar esta publicación' })
        }

        // Eliminar
        const success = await deletePost(postId)

        if (!success) {
            return reply.code(500).send({ message: 'Error eliminando publicación' })
        }

        return reply.send({ message: 'Publicación eliminada exitosamente' })
    } catch (error) {
        console.error('Error eliminando post:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}