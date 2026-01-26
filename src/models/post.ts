import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { getPostImages, type PostImage } from './postImage.js'

export interface Post {
    id: number
    title: string
    description: string
    user_id: number
    created_at: Date
    updated_at: Date
}

export interface PostWithUserAndImages extends Post {
    user_name: string
    user_username: string
    user_image: string | null
    images: PostImage[]
}

// ==================== CREAR POST ====================
export async function createPost(
    userId: number,
    title: string,
    description: string
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO posts (user_id, title, description) VALUES (?, ?, ?)`,
            [userId, title, description]
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
    offset: number = 0
): Promise<PostWithUserAndImages[]> {
    const [rows] = await pool.query<(RowDataPacket & Post)[]>(
        `SELECT 
            p.id,
            p.title,
            p.description,
            p.user_id,
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image
         FROM posts p
         INNER JOIN users u ON p.user_id = u.id
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
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
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image
         FROM posts p
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
    offset: number = 0
): Promise<PostWithUserAndImages[]> {
    const [rows] = await pool.query<(RowDataPacket & Post)[]>(
        `SELECT 
            p.id,
            p.title,
            p.description,
            p.user_id,
            p.created_at,
            p.updated_at,
            u.name as user_name,
            u.username as user_username,
            u.image as user_image
         FROM posts p
         INNER JOIN users u ON p.user_id = u.id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
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
export async function countAllPosts(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM posts'
    )
    return rows[0]?.total ?? 0
}

export async function countPostsByUserId(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM posts WHERE user_id = ?',
        [userId]
    )
    return rows[0]?.total ?? 0
}