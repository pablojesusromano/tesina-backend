import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { getPostImages, type PostImage } from './postImage.js'
import { findStatusByName, resolveStatusIds, type PostStatusName } from './postStatus.js'

export interface Post {
    id: number
    title: string
    description: string
    user_id: number
    status_id: number
    created_at: Date
    updated_at: Date
}

export interface PostWithUserAndImages extends Post {
    status_name: PostStatusName
    user_name: string
    user_username: string
    user_image: string | null
    images: PostImage[]
}

// ==================== CREAR POST ====================
export async function createPost(
    userId: number,
    title: string,
    description: string,
    status: number
): Promise<number | null> {
    try {

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO posts (user_id, title, description, status_id) VALUES (?, ?, ?, ?)`,
            [userId, title, description, status]
        )
        return result.insertId
    } catch (error) {
        console.error('Error creando post:', error)
        return null
    }
}

// ==================== OBTENER TODOS LOS POSTS ====================
export async function getAllPosts(
    limit: number = 20,
    offset: number = 0,
    statuses: PostStatusName[] = ['ACTIVO'],
    userId: number
): Promise<PostWithUserAndImages[]> {
    const statusIds = await resolveStatusIds(statuses)
    if (!statusIds.length) return []

    const ph = statusIds.map(() => '?').join(', ')

    const [rows] = await pool.query<(RowDataPacket & Post)[]>(
        `SELECT 
            p.id,
            p.title,
            p.description,
            p.user_id,
            p.status_id,
            ps.name as status_name,
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image,
            count(c.id) as comments_count,
            s.name as species_name,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM likes l 
                    WHERE l.post_id = p.id AND l.user_id = ?
                ) THEN 1 
                ELSE 0 
            END as liked
        FROM posts p
        INNER JOIN post_status ps ON p.status_id = ps.id
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN comments c ON p.id = c.post_id
        INNER JOIN species s ON s.id = p.species_id
        WHERE p.status_id IN (${ph})
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, ...statusIds, limit, offset]
    )

    const postsWithImages = await Promise.all(
        rows.map(async (post: any) => {
            const images = await getPostImages(post.id)
            return { ...post, images } as PostWithUserAndImages
        })
    )

    return postsWithImages
}

// ==================== OBTENER POST POR ID ====================
export async function findPostById(postId: number): Promise<PostWithUserAndImages | null> {
    const [rows] = await pool.query<(RowDataPacket & Post)[]>(
        `SELECT 
            p.id,
            p.title,
            p.description,
            p.user_id,
            p.status_id,
            ps.name as status_name,
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image
         FROM posts p
         INNER JOIN post_status ps ON p.status_id = ps.id
         INNER JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
        [postId]
    )

    if (rows.length === 0) return null

    const post = rows[0] as any
    const images = await getPostImages(postId)
    post.images = images

    return post as PostWithUserAndImages
}

// ==================== OBTENER POSTS DE UN USUARIO ====================
export async function getPostsByUserId(
    userId: number,
    limit: number = 20,
    offset: number = 0,
    statuses: PostStatusName[] = ['ACTIVO']
): Promise<PostWithUserAndImages[]> {
    const statusIds = await resolveStatusIds(statuses)
    if (!statusIds.length) return []

    const ph = statusIds.map(() => '?').join(', ')

    const [rows] = await pool.query<(RowDataPacket & Post)[]>(
        `SELECT 
            p.id,
            p.title,
            p.description,
            p.user_id,
            p.status_id,
            ps.name as status_name,
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image
         FROM posts p
         INNER JOIN post_status ps ON p.status_id = ps.id
         INNER JOIN users u ON p.user_id = u.id
         WHERE p.user_id = ? AND p.status_id IN (${ph})
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, ...statusIds, limit, offset]
    )

    const postsWithImages = await Promise.all(
        rows.map(async (post: any) => {
            const images = await getPostImages(post.id)
            return { ...post, images } as PostWithUserAndImages
        })
    )

    return postsWithImages
}

// ==================== ACTUALIZAR POST ====================
export async function updatePost(
    postId: number,
    title?: string,
    description?: string
): Promise<boolean> {
    try {
        const updates: string[] = []
        const values: any[] = []

        if (title !== undefined) {
            updates.push('title = ?')
            values.push(title)
        }
        if (description !== undefined) {
            updates.push('description = ?')
            values.push(description)
        }

        if (updates.length === 0) return false

        values.push(postId)

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`,
            values
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error actualizando post:', error)
        return false
    }
}

// ==================== ACTUALIZAR STATUS ====================
export async function updatePostStatus(
    postId: number,
    statusName: PostStatusName
): Promise<boolean> {
    try {
        const status = await findStatusByName(statusName)
        if (!status) throw new Error(`Status "${statusName}" no encontrado en post_status`)

        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE posts SET status_id = ? WHERE id = ?',
            [status.id, postId]
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error actualizando status del post:', error)
        return false
    }
}

// ==================== ELIMINAR POST ====================
export async function deletePost(postId: number): Promise<boolean> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM posts WHERE id = ?',
            [postId]
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error eliminando post:', error)
        return false
    }
}

// ==================== CONTAR POSTS ====================
export async function countAllPosts(statuses: PostStatusName[] = ['ACTIVO']): Promise<number> {
    const statusIds = await resolveStatusIds(statuses)
    if (!statusIds.length) return 0

    const ph = statusIds.map(() => '?').join(', ')
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM posts WHERE status_id IN (${ph})`,
        statusIds
    )
    return rows[0]?.total ?? 0
}

export async function countPostsByUserId(
    userId: number,
    statuses: PostStatusName[] = ['ACTIVO']
): Promise<number> {
    const statusIds = await resolveStatusIds(statuses)
    if (!statusIds.length) return 0

    const ph = statusIds.map(() => '?').join(', ')
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM posts WHERE user_id = ? AND status_id IN (${ph})`,
        [userId, ...statusIds]
    )
    return rows[0]?.total ?? 0
}

// ==================== DAR LIKE A POST ====================
export async function likePostById(userId: number, postId: number): Promise<number | null> {
    try {
        // Verificar si ya existe para evitar errores de clave duplicada si no hay constraints (aunque debería haber)
        // O simplemente intentar insertar.
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO post_likes (user_id, post_id) VALUES (?, ?)',
            [userId, postId]
        )
        return result.insertId || (result.affectedRows === 0 ? null : result.insertId)
        // Si insert ignore y ya existe, affectedRows es 0. 
        // Pero queremos saber si se dio like.
        // Si ya existia, quizas devolver ID del existente? O null indicando "ya estaba".
        // El controller maneja "null" como error o "ya diste like".
    } catch (error) {
        console.error('Error dando like:', error)
        return null
    }
}

// ==================== QUITAR LIKE ====================
export async function unlikePost(userId: number, postId: number): Promise<boolean> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
            [userId, postId]
        )
        console.log(result)
        console.log("userId: " + userId);
        console.log("postId: " + postId);
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error quitando like:', error)
        return false
    }
}

// Agrego unlikePostById por compatibilidad si se usara el ID del like, 
// pero el requerimiento pide usar ID del post. 
// Dejo unlikePost como principal.

// ==================== OBTENER POSTS LIKEADOS ====================
export async function getLikedPostsByUserId(
    userId: number,
    limit: number = 20,
    offset: number = 0
): Promise<(PostWithUserAndImages & { like_id: number })[]> {
    const [rows] = await pool.query<(RowDataPacket & Post)[]>(
        `SELECT 
            p.id,
            p.title,
            p.description,
            p.user_id,
            p.status_id,
            ps.name as status_name,
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image,
            pl.id as like_id
        FROM post_likes pl
        INNER JOIN posts p ON pl.post_id = p.id
        INNER JOIN post_status ps ON p.status_id = ps.id
        INNER JOIN users u ON p.user_id = u.id
        WHERE pl.user_id = ?
        ORDER BY pl.created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    )

    const postsWithImages = await Promise.all(
        rows.map(async (post: any) => {
            const images = await getPostImages(post.id)
            return { ...post, images }
        })
    )

    return postsWithImages as (PostWithUserAndImages & { like_id: number })[]
}

// ==================== COMENTARIOS ====================
export async function addCommentToPost(
    userId: number,
    postId: number,
    parentId: number | null,
    content: string
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO comments (user_id, post_id, parent_id, content) VALUES (?, ?, ?, ?)',
            [userId, postId, parentId, content]
        )
        return result.insertId
    } catch (error) {
        console.error('Error agregando comentario:', error)
        return null
    }
}

export async function deleteCommentById(commentId: number): Promise<boolean> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM comments WHERE id = ?',
            [commentId]
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error eliminando comentario:', error)
        return false
    }
}

export async function getCommentsByPostId(postId: number): Promise<any[]> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                pc.id,
                pc.content,
                pc.parent_id,
                pc.created_at,
                u.id as user_id,
                u.name as user_name,
                u.username as user_username,
                u.image as user_image
            FROM comments pc
            INNER JOIN users u ON pc.user_id = u.id
            WHERE pc.post_id = ?
            ORDER BY pc.created_at ASC`, // Ordenados por fecha de creación
            [postId]
        )
        return rows
    } catch (error) {
        console.error('Error obteniendo comentarios:', error)
        return []
    }
}

// Helper para validar propiedad
export async function getCommentById(commentId: number): Promise<any | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM comments WHERE id = ?',
        [commentId]
    )
    return rows[0] || null
}