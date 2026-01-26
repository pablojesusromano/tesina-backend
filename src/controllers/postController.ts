import type { FastifyRequest, FastifyReply } from 'fastify'
import { UPLOADS_BASE_URL, ALLOWED_TYPES, MAX_FILES } from '../config/upload.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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
import { 
    createPostImage, 
    deletePostImages
} from '../models/postImage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== CREAR POST ====================
export async function createNewPost(req: FastifyRequest, reply: FastifyReply) {
    const authType = (req as any).authType
    
    if (authType === 'admin') {
        return reply.code(403).send({ 
            message: 'Los administradores no pueden crear publicaciones. Use una cuenta de usuario.' 
        })
    }

    const user = (req as any).user

    try {
        let title: string | undefined
        let description: string | undefined
        const uploadedFiles: { filename: string; filepath: string }[] = []

        // Procesar multipart data
        const parts = req.parts()
        
        for await (const part of parts) {
            if (part.type === 'field') {
                if (part.fieldname === 'title') {
                    title = part.value as string
                } else if (part.fieldname === 'description') {
                    description = part.value as string
                }
            } else {
                // Es un archivo
                if (uploadedFiles.length >= MAX_FILES) {
                    return reply.code(400).send({ 
                        message: `Máximo ${MAX_FILES} imágenes permitidas` 
                    })
                }

                // Validar tipo
                if (!ALLOWED_TYPES.includes(part.mimetype)) {
                    return reply.code(400).send({ 
                        message: 'Tipo de archivo no permitido. Solo JPG, PNG, WebP o HEIC' 
                    })
                }

                // Generar nombre único
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
                const ext = path.extname(part.filename)
                const filename = `${uniqueSuffix}${ext}`
                const filepath = path.join(__dirname, '../../uploads/posts', filename)

                // Crear directorio si no existe
                const uploadDir = path.join(__dirname, '../../uploads/posts')
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true })
                }

                // Guardar archivo
                const buffer = await part.toBuffer()
                fs.writeFileSync(filepath, buffer)

                uploadedFiles.push({ filename, filepath })
            }
        }

        // Validar campos
        if (!title || !description) {
            // Limpiar archivos subidos
            uploadedFiles.forEach(f => {
                if (fs.existsSync(f.filepath)) fs.unlinkSync(f.filepath)
            })
            return reply.code(400).send({ 
                message: 'Título y descripción son obligatorios' 
            })
        }

        if (uploadedFiles.length === 0) {
            return reply.code(400).send({ 
                message: 'Debes subir al menos 1 imagen' 
            })
        }

        if (title.length < 3 || title.length > 200) {
            uploadedFiles.forEach(f => {
                if (fs.existsSync(f.filepath)) fs.unlinkSync(f.filepath)
            })
            return reply.code(400).send({ 
                message: 'El título debe tener entre 3 y 200 caracteres' 
            })
        }

        if (description.length < 10 || description.length > 5000) {
            uploadedFiles.forEach(f => {
                if (fs.existsSync(f.filepath)) fs.unlinkSync(f.filepath)
            })
            return reply.code(400).send({ 
                message: 'La descripción debe tener entre 10 y 5000 caracteres' 
            })
        }

        // Crear post
        const postId = await createPost(user.id, title, description)

        if (!postId) {
            // Limpiar archivos
            uploadedFiles.forEach(f => {
                if (fs.existsSync(f.filepath)) fs.unlinkSync(f.filepath)
            })
            return reply.code(500).send({ message: 'Error creando publicación' })
        }

        // Guardar rutas de imágenes
        await Promise.all(
            uploadedFiles.map((file, index) => {
                const imagePath = `${UPLOADS_BASE_URL}/${file.filename}`
                return createPostImage(postId, imagePath, index)
            })
        )

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
    const authType = (req as any).authType
    
    if (authType === 'admin') {
        // Los admins no tienen posts propios
        return reply.code(403).send({ 
            message: 'Los administradores no tienen publicaciones propias' 
        })
    }
    
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
    const authType = (req as any).authType
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

        // ADMINS pueden editar cualquier post
        // USERS solo pueden editar sus propios posts
        if (authType === 'user') {
            const user = (req as any).user
            if (post.user_id !== user.id) {
                return reply.code(403).send({ 
                    message: 'No tienes permiso para editar esta publicación' 
                })
            }
        }
        // Si es admin, puede editar cualquier post (no hay verificación adicional)

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
    const authType = (req as any).authType
    const { id } = req.params as { id: string }
    const postId = Number(id)

    try {
        const post = await findPostById(postId)

        if (!post) {
            return reply.code(404).send({ message: 'Publicación no encontrada' })
        }

        if (authType === 'user') {
            const user = (req as any).user
            if (post.user_id !== user.id) {
                return reply.code(403).send({ 
                    message: 'No tienes permiso para eliminar esta publicación' 
                })
            }
        }

        // Eliminar imágenes (archivos y BD)
        await deletePostImages(postId)

        // Eliminar post
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