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
    updatePostStatus,
    countAllPosts,
    countPostsByUserId
} from '../models/post.js'
import { 
    createPostImage
} from '../models/postImage.js'
import { POST_STATUS_NAMES, type PostStatusName, getAllStatusNames } from '../models/postStatus.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== CACHÉ DE ESTADOS VÁLIDOS ====================
let validStatusesCache: PostStatusName[] | null = null

async function getValidStatuses(): Promise<PostStatusName[]> {
    if (!validStatusesCache) {
        validStatusesCache = await getAllStatusNames()
    }
    return validStatusesCache
}

// ==================== TRANSICIONES VÁLIDAS POR ROL ====================
const USER_TRANSITIONS: Record<PostStatusName, PostStatusName[]> = {
    BORRADOR:  ['ACTIVO', 'ELIMINADO'],
    ACTIVO:    ['ELIMINADO'],
    RECHAZADO: ['ELIMINADO'],
    ELIMINADO: [],
    REVISION:  ['ELIMINADO']
}

const ADMIN_TRANSITIONS: Record<PostStatusName, PostStatusName[]> = {
    BORRADOR:  ['REVISION', 'ELIMINADO'],
    ACTIVO:    ['RECHAZADO', 'ELIMINADO'],
    RECHAZADO: ['BORRADOR', 'ELIMINADO'],
    ELIMINADO: [],
    REVISION:  ['ACTIVO', 'RECHAZADO', 'ELIMINADO']
}

// ==================== HELPER: PARSEAR ESTADOS DEL QUERY ====================
async function parseStatusesFromQuery(
    statusQuery?: string | string[],
    defaultStatuses: PostStatusName[] | 'ALL' = ['ACTIVO']
): Promise<PostStatusName[]> {
    const validStatuses = await getValidStatuses()
    
    // Si no hay query, retornar el default
    if (!statusQuery) {
        return defaultStatuses === 'ALL' ? validStatuses : defaultStatuses
    }

    // Si viene como string, convertir a array
    const statusArray = Array.isArray(statusQuery) ? statusQuery : [statusQuery]
    
    // Filtrar solo los estados válidos
    const filteredStatuses = statusArray.filter(s => 
        validStatuses.includes(s as PostStatusName)
    ) as PostStatusName[]

    // Si después del filtrado no hay estados válidos, retornar el default
    if (filteredStatuses.length === 0) {
        return defaultStatuses === 'ALL' ? validStatuses : defaultStatuses
    }
    
    return filteredStatuses
}

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
        let imagesMetadata: Array<{index: number, latitude?: number, longitude?: number}> = []
        const uploadedFiles: { filename: string; filepath: string }[] = []

        const parts = req.parts()
        
        for await (const part of parts) {
            if (part.type === 'field') {
                if (part.fieldname === 'title') {
                    title = part.value as string
                } else if (part.fieldname === 'description') {
                    description = part.value as string
                } else if (part.fieldname === 'images_metadata') {
                    try {
                        imagesMetadata = JSON.parse(part.value as string)
                    } catch (e) {
                        console.error('Error parseando images_metadata:', e)
                    }
                }
            } else {
                if (uploadedFiles.length >= MAX_FILES) {
                    return reply.code(400).send({ 
                        message: `Máximo ${MAX_FILES} imágenes permitidas` 
                    })
                }

                if (!ALLOWED_TYPES.includes(part.mimetype)) {
                    return reply.code(400).send({ 
                        message: 'Tipo de archivo no permitido. Solo JPG, PNG, WebP o HEIC' 
                    })
                }

                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
                const ext = path.extname(part.filename)
                const filename = `${uniqueSuffix}${ext}`
                const filepath = path.join(__dirname, '../../uploads/posts', filename)

                const uploadDir = path.join(__dirname, '../../uploads/posts')
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true })
                }

                const buffer = await part.toBuffer()
                fs.writeFileSync(filepath, buffer)

                uploadedFiles.push({ filename, filepath })
            }
        }

        if (!title || !description) {
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

        const postId = await createPost(user.id, title, description)

        if (!postId) {
            uploadedFiles.forEach(f => {
                if (fs.existsSync(f.filepath)) fs.unlinkSync(f.filepath)
            })
            return reply.code(500).send({ message: 'Error creando publicación' })
        }

        await Promise.all(
            uploadedFiles.map((file, index) => {
                const imagePath = `${UPLOADS_BASE_URL}/${file.filename}`
                
                // Buscar metadata para esta imagen
                const metadata = imagesMetadata.find(m => m.index === index)
                const latitude = metadata?.latitude ?? null
                const longitude = metadata?.longitude ?? null
                
                return createPostImage(postId, imagePath, index, latitude, longitude)
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
    const authType = (req as any).authType
    const { page = 1, pageSize = 20, statuses: statusesQuery } = req.query as {
        page?: number
        pageSize?: number
        statuses?: string | string[]
    }

    const validPage = Math.max(1, Number(page))
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
    const offset = (validPage - 1) * validPageSize

    // Parsear estados desde el query
    let statuses: PostStatusName[]
    
    if (authType === 'admin') {
        // Admin puede filtrar por cualquier estado
        statuses = await parseStatusesFromQuery(statusesQuery)
    } else {
        // Usuario solo puede ver ACTIVO en el feed público
        // (sin importar lo que solicite en el query)
        statuses = ['ACTIVO']
    }

    try {
        const posts = await getAllPosts(validPageSize, offset, statuses)
        const total = await countAllPosts(statuses)

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
            if (post.user_id !== user.id && post.status_name !== POST_STATUS_NAMES.ACTIVO) {
                return reply.code(404).send({ message: 'Publicación no encontrada' })
            }
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
        return reply.code(403).send({ 
            message: 'Los administradores no tienen publicaciones propias' 
        })
    }
    
    const user = (req as any).user
    const { page = 1, pageSize = 20, statuses: statusesQuery } = req.query as {
        page?: number
        pageSize?: number
        statuses?: string | string[]
    }

    const validPage = Math.max(1, Number(page))
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
    const offset = (validPage - 1) * validPageSize

    // El usuario puede ver todos sus posts en cualquier estado
    // Por defecto trae TODOS, pero puede filtrar si lo desea
    const statuses = await parseStatusesFromQuery(statusesQuery, 'ALL')

    try {
        const posts = await getPostsByUserId(user.id, validPageSize, offset, statuses)
        const total = await countPostsByUserId(user.id, statuses)

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
    const authType = (req as any).authType
    const { userId } = req.params as { userId: string }
    const { page = 1, pageSize = 20, statuses: statusesQuery } = req.query as {
        page?: number
        pageSize?: number
        statuses?: string | string[]
    }

    const validUserId = Number(userId)
    const validPage = Math.max(1, Number(page))
    const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
    const offset = (validPage - 1) * validPageSize

    const isOwner = authType === 'user' && (req as any).user.id === validUserId
    
    // Determinar qué estados puede ver
    let statuses: PostStatusName[]
    
    if (authType === 'admin') {
        // Admin puede ver todos los estados que solicite (default: ACTIVO)
        statuses = await parseStatusesFromQuery(statusesQuery)
    } else if (isOwner) {
        // El dueño puede ver todos sus posts en cualquier estado (default: ACTIVO)
        statuses = await parseStatusesFromQuery(statusesQuery)
    } else {
        // Otros usuarios solo pueden ver posts ACTIVO
        statuses = ['ACTIVO']
    }

    try {
        const posts = await getPostsByUserId(validUserId, validPageSize, offset, statuses)
        const total = await countPostsByUserId(validUserId, statuses)

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
        const post = await findPostById(postId)

        if (!post) {
            return reply.code(404).send({ message: 'Publicación no encontrada' })
        }

        if (post.status_name !== POST_STATUS_NAMES.BORRADOR && post.status_name !== POST_STATUS_NAMES.ACTIVO) {
            return reply.code(403).send({ 
                message: `No se puede editar una publicación con estado "${post.status_name}"` 
            })
        }

        if (authType === 'user') {
            const user = (req as any).user
            if (post.user_id !== user.id) {
                return reply.code(403).send({ 
                    message: 'No tienes permiso para editar esta publicación' 
                })
            }
        }

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

// ==================== CAMBIAR ESTADO ====================
export async function updatePostStatusById(req: FastifyRequest, reply: FastifyReply) {
    const authType = (req as any).authType
    const { id } = req.params as { id: string }
    const postId = Number(id)
    const { status } = req.body as { status: string }

    try {
        const post = await findPostById(postId)

        if (!post) {
            return reply.code(404).send({ message: 'Publicación no encontrada' })
        }

        if (authType === 'user') {
            const user = (req as any).user
            if (post.user_id !== user.id) {
                return reply.code(403).send({ 
                    message: 'No tienes permiso para cambiar el estado de esta publicación' 
                })
            }
        }

        const transitions = authType === 'admin' ? ADMIN_TRANSITIONS : USER_TRANSITIONS
        const allowed = transitions[post.status_name]

        if (!allowed?.includes(status as PostStatusName)) {
            return reply.code(400).send({ 
                message: `Transición "${post.status_name}" → "${status}" no permitida` 
            })
        }

        const success = await updatePostStatus(postId, status as PostStatusName)

        if (!success) {
            return reply.code(500).send({ message: 'Error actualizando estado' })
        }

        const updatedPost = await findPostById(postId)

        return reply.send({
            message: `Estado actualizado a "${status}" exitosamente`,
            post: updatedPost
        })
    } catch (error) {
        console.error('Error actualizando estado del post:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== ELIMINAR POST ====================
// TO DO: AGREGAR EL DELETED_AT A LA TABLA POST
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

        if (post.status_name === POST_STATUS_NAMES.ELIMINADO) {
            return reply.code(400).send({ message: 'La publicación ya está eliminada' })
        }

        const success = await updatePostStatus(postId, POST_STATUS_NAMES.ELIMINADO)

        if (!success) {
            return reply.code(500).send({ message: 'Error eliminando publicación' })
        }

        return reply.send({ message: 'Publicación eliminada exitosamente' })
    } catch (error) {
        console.error('Error eliminando post:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}