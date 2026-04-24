import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface PostTag {
    id: number
    post_id: number
    tagged_user_id: number
    created_at: Date
}

export interface TaggedUser {
    id: number
    username: string | null
    name: string | null
    image: string | null
}

// ==================== SYNC TAGS (DELETE + INSERT) ====================
export async function setPostTags(postId: number, taggedUserIds: number[]): Promise<boolean> {
    const conn = await pool.getConnection()
    try {
        await conn.beginTransaction()

        // Borrar tags existentes
        await conn.query<ResultSetHeader>(
            'DELETE FROM post_tags WHERE post_id = ?',
            [postId]
        )

        // Insertar nuevas tags (si hay)
        if (taggedUserIds.length > 0) {
            const values = taggedUserIds.map(uid => [postId, uid])
            await conn.query<ResultSetHeader>(
                'INSERT IGNORE INTO post_tags (post_id, tagged_user_id) VALUES ?',
                [values]
            )
        }

        await conn.commit()
        return true
    } catch (error) {
        await conn.rollback()
        console.error('Error sincronizando tags del post:', error)
        return false
    } finally {
        conn.release()
    }
}

// ==================== OBTENER USUARIOS ETIQUETADOS ====================
export async function getPostTags(postId: number): Promise<TaggedUser[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.username, u.name, u.image
         FROM post_tags pt
         INNER JOIN users u ON pt.tagged_user_id = u.id
         WHERE pt.post_id = ?
         ORDER BY pt.created_at ASC`,
        [postId]
    )
    return rows as TaggedUser[]
}

// ==================== OBTENER IDs DE USUARIOS ETIQUETADOS ====================
export async function getPostTagIds(postId: number): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT tagged_user_id FROM post_tags WHERE post_id = ?',
        [postId]
    )
    return rows.map((r: any) => r.tagged_user_id)
}
