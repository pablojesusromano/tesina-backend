import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export type DBUser = {
    id: number
    email: string
    username: string
    password_hash: string | null
    google_id: string | null
    facebook_id: string | null
    name: string | null
    image: string | null
    role_id: number
    user_type_id: number
    points: number
    created_at: Date
    updated_at: Date | null
}

/** Buscar usuario por email */
export async function findUserByEmail(email: string): Promise<DBUser | null> {
    const [rows] = await pool.query<(DBUser & RowDataPacket)[]>(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
    )
    return rows[0] ?? null
}

/** Buscar usuario por username */
export async function findUserByUsername(username: string): Promise<DBUser | null> {
    const [rows] = await pool.query<(DBUser & RowDataPacket)[]>(
        'SELECT * FROM users WHERE username = ? LIMIT 1',
        [username]
    )
    return rows[0] ?? null
}

/** Buscar usuario por id */
export async function findUserById(id: number): Promise<DBUser | null> {
    const [rows] = await pool.query<(DBUser & RowDataPacket)[]>(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [id]
    )
    return rows[0] ?? null
}

/** Buscar por email O username (útil para login) */
export async function findUserByEmailOrUsername(identifier: string): Promise<DBUser | null> {
    const [rows] = await pool.query<(DBUser & RowDataPacket)[]>(
        'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
        [identifier, identifier]
    )
    return rows[0] ?? null
}

/**
 * Crear usuario local (email + username + password_hash)
 * - role_id y user_type_id por defecto: 1=user, 1=usuario_comun (ajustá si querés)
 * - name se arma con name + lastname (si los pasás separados)
 */
export async function createUser(
    name: string,
    email: string,
    username: string,
    hashedPassword: string,
    opts?: { roleId?: number; userTypeId?: number; image?: string | null }
): Promise<number | null> {
    const roleId = opts?.roleId ?? 1
    const userTypeId = opts?.userTypeId ?? 1
    const image = opts?.image ?? null

    const [res] = await pool.execute<ResultSetHeader>(
        `INSERT INTO users (email, username, password_hash, name, image, role_id, user_type_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [email, username, hashedPassword, name, image, roleId, userTypeId]
    )
    return res.insertId || null
}

/** Vincular Google a un usuario existente */
export async function linkGoogleId(userId: number, googleId: string): Promise<void> {
    await pool.execute(
        'UPDATE users SET google_id = ? WHERE id = ?',
        [googleId, userId]
    )
}

/** Vincular Facebook a un usuario existente */
export async function linkFacebookId(userId: number, facebookId: string): Promise<void> {
    await pool.execute(
        'UPDATE users SET facebook_id = ? WHERE id = ?',
        [facebookId, userId]
    )
}

/** Setear/actualizar password_hash para usuario local */
export async function setPasswordHash(userId: number, passwordHash: string): Promise<void> {
    await pool.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, userId]
    )
}

/** (Opcional) Actualizar username asegurando unicidad (capturá ER_DUP_ENTRY arriba) */
export async function updateUsername(userId: number, username: string): Promise<void> {
    await pool.execute(
        'UPDATE users SET username = ? WHERE id = ?',
        [username, userId]
    )
}
