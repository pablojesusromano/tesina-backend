import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface Post {
    id: number
    title: string
    description: string
    user_id: number
    created_at: Date
    updated_at: Date
}

// Interfaz extendida con datos del usuario
export interface PostWithUser extends Post {
    user_name: string
    user_username: string
    user_image: string | null
}

// ==================== CREAR POST ====================
export async function createPost(
    userId: number,
    title: string,
    description: string
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO posts (user_id, title, description)
             VALUES (?, ?, ?)`,
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
): Promise<PostWithUser[]> {
    const [rows] = await pool.query<(RowDataPacket & PostWithUser)[]>(
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
    return rows
}

// ==================== OBTENER POST POR ID ====================
export async function findPostById(postId: number): Promise<PostWithUser | null> {
    const [rows] = await pool.query<(RowDataPacket & PostWithUser)[]>(
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
    return rows[0] ?? null
}

// ==================== OBTENER POSTS DE UN USUARIO ====================
export async function getPostsByUserId(
    userId: number,
    limit: number = 20,
    offset: number = 0
): Promise<PostWithUser[]> {
    const [rows] = await pool.query<(RowDataPacket & PostWithUser)[]>(
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
    return rows
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
    return rows[0]?.total
}

export async function countPostsByUserId(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM posts WHERE user_id = ?',
        [userId]
    )
    return rows[0]?.total
}