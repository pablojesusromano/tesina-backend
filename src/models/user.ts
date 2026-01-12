import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface User {
    id: number
    firebase_uid: string
    name: string | null      // Opcional en la BD
    username: string | null  // Opcional en la BD
    image: string | null
    user_type_id: number | null  // Opcional en la BD
    points: number
    created_at: Date
    updated_at: Date | null
}

export async function findUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const [rows] = await pool.execute<(User & RowDataPacket)[]>(
        'SELECT * FROM users WHERE firebase_uid = ?',
        [firebaseUid]
    )
    return rows[0] || null
}

export async function findUserByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.execute<(User & RowDataPacket)[]>(
        'SELECT * FROM users WHERE username = ?',
        [username]
    )
    return rows[0] || null
}

export async function findUserById(id: number): Promise<User | null> {
    const [rows] = await pool.execute<(User & RowDataPacket)[]>(
        'SELECT * FROM users WHERE id = ?',
        [id]
    )
    return rows[0] || null
}

export async function createUser(
    firebaseUid: string,
    name: string,
    username: string,
    userTypeId?: number | null,
    image?: string | null
): Promise<number | null> {
    const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO users (firebase_uid, name, username, user_type_id, image, points) VALUES (?, ?, ?, ?, ?, 0)',
        [firebaseUid, name, username, userTypeId || null, image || null]
    )
    return result.insertId || null
}

export async function updateUser(
    id: number,
    data: Partial<Omit<User, 'id' | 'firebase_uid' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []

    if (data.name !== undefined) {
        fields.push('name = ?')
        values.push(data.name)
    }
    if (data.username !== undefined) {
        fields.push('username = ?')
        values.push(data.username)
    }
    if (data.image !== undefined) {
        fields.push('image = ?')
        values.push(data.image)
    }
    if (data.user_type_id !== undefined) {
        fields.push('user_type_id = ?')
        values.push(data.user_type_id)
    }
    if (data.points !== undefined) {
        fields.push('points = ?')
        values.push(data.points)
    }

    if (fields.length === 0) return false

    values.push(id)
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
    )
    return result.affectedRows > 0
}

export async function addPoints(userId: number, points: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE users SET points = points + ? WHERE id = ?',
        [points, userId]
    )
    return result.affectedRows > 0
}

export async function deleteUser(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM users WHERE id = ?',
        [id]
    )
    return result.affectedRows > 0
}