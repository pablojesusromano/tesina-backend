import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface PostImage {
    id: number
    post_id: number
    latitude: number | null
    longitude: number | null
    image_path: string
    image_order: number
    created_at: Date
}

// ==================== CREAR IMAGEN ====================
export async function createPostImage(
    postId: number,
    imagePath: string,
    imageOrder: number,
    latitude?: number | null,
    longitude?: number | null
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO post_images (post_id, latitude, longitude, image_path, image_order) 
            VALUES (?, ?, ?, ?, ?)`,
            [postId, latitude ?? null, longitude ?? null, imagePath, imageOrder]
        )
        return result.insertId
    } catch (error) {
        console.error('Error creando imagen:', error)
        return null
    }
}

// ==================== OBTENER IMÁGENES DE UN POST ====================
export async function getPostImages(postId: number): Promise<PostImage[]> {
    const [rows] = await pool.query<(RowDataPacket & PostImage)[]>(
        `SELECT * FROM post_images 
         WHERE post_id = ? 
         ORDER BY image_order ASC`,
        [postId]
    )
    return rows
}

// ==================== ELIMINAR IMÁGENES DE UN POST ====================
export async function deletePostImages(postId: number): Promise<boolean> {
    try {
        const images = await getPostImages(postId)
        
        // Eliminar archivos del filesystem
        for (const image of images) {
            const fullPath = path.join(__dirname, '../../uploads/posts', path.basename(image.image_path))
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath)
            }
        }
        
        // Eliminar registros de BD
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM post_images WHERE post_id = ?',
            [postId]
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error eliminando imágenes:', error)
        return false
    }
}

// ==================== ELIMINAR UNA IMAGEN ESPECÍFICA ====================
export async function deletePostImage(imageId: number): Promise<boolean> {
    try {
        const [rows] = await pool.query<(RowDataPacket & PostImage)[]>(
            'SELECT * FROM post_images WHERE id = ?',
            [imageId]
        )
        
        if (rows.length === 0) return false
        
        const image = rows[0]
        
        if (image) {
            const fullPath = path.join(__dirname, '../../uploads/posts', path.basename(image.image_path))
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath)
            }
        }
        
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM post_images WHERE id = ?',
            [imageId]
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error eliminando imagen:', error)
        return false
    }
}

// ==================== CONTAR IMÁGENES DE UN POST ====================
export async function countPostImages(postId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM post_images WHERE post_id = ?',
        [postId]
    )
    return rows[0]?.total ?? 0
}