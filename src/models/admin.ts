import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface Admin {
    id: number
    email: string
    username: string | null  // Ahora es opcional en la BD
    password_hash: string
    name: string | null      // Ahora es opcional en la BD
    image: string | null
    created_at: Date
    updated_at: Date | null
}

export async function findAdminByEmail(email: string): Promise<Admin | null> {
    const [rows] = await pool.execute<(Admin & RowDataPacket)[]>(
        'SELECT * FROM admins WHERE email = ?',
        [email]
    )
    return rows[0] || null
}

export async function findAdminByUsername(username: string): Promise<Admin | null> {
    const [rows] = await pool.execute<(Admin & RowDataPacket)[]>(
        'SELECT * FROM admins WHERE username = ?',
        [username]
    )
    return rows[0] || null
}

export async function findAdminByEmailOrUsername(identifier: string): Promise<Admin | null> {
    const [rows] = await pool.execute<(Admin & RowDataPacket)[]>(
        'SELECT * FROM admins WHERE email = ? OR username = ?',
        [identifier, identifier]
    )
    return rows[0] || null
}

export async function findAdminById(id: number): Promise<Admin | null> {
    const [rows] = await pool.execute<(Admin & RowDataPacket)[]>(
        'SELECT * FROM admins WHERE id = ?',
        [id]
    )
    return rows[0] || null
}

export async function createAdmin(
    email: string,
    username: string | null,
    passwordHash: string,
    name: string | null,
    image?: string | null
): Promise<number | null> {
    const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO admins (email, username, password_hash, name, image) VALUES (?, ?, ?, ?, ?)',
        [email, username, passwordHash, name, image || null]
    )
    return result.insertId || null
}

export async function updateAdmin(
    id: number,
    data: Partial<Omit<Admin, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []

    if (data.email !== undefined) {
        fields.push('email = ?')
        values.push(data.email)
    }
    if (data.username !== undefined) {
        fields.push('username = ?')
        values.push(data.username)
    }
    if (data.name !== undefined) {
        fields.push('name = ?')
        values.push(data.name)
    }
    if (data.image !== undefined) {
        fields.push('image = ?')
        values.push(data.image)
    }
    if (data.password_hash !== undefined) {
        fields.push('password_hash = ?')
        values.push(data.password_hash)
    }

    if (fields.length === 0) return false

    values.push(id)
    const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE admins SET ${fields.join(', ')} WHERE id = ?`,
        values
    )
    return result.affectedRows > 0
}

export async function deleteAdmin(id: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM admins WHERE id = ?',
        [id]
    )
    return result.affectedRows > 0
}