import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export type DBRole = {
    id: number
    name: string
    public_name: string
    created_at: Date
    updated_at: Date | null
}

/** Buscar rol por ID */
export async function findRoleById(id: number): Promise<DBRole | null> {
    const [rows] = await pool.query<(DBRole & RowDataPacket)[]>(
        'SELECT * FROM roles WHERE id = ? LIMIT 1',
        [id]
    )
    return rows[0] ?? null
}

/** Buscar rol por name */
export async function findRoleByName(name: string): Promise<DBRole | null> {
    const [rows] = await pool.query<(DBRole & RowDataPacket)[]>(
        'SELECT * FROM roles WHERE name = ? LIMIT 1',
        [name]
    )
    return rows[0] ?? null
}

/** Obtener todos los roles */
export async function getAllRoles(): Promise<DBRole[]> {
    const [rows] = await pool.query<(DBRole & RowDataPacket)[]>(
        'SELECT * FROM roles ORDER BY id ASC'
    )
    return rows
}

/** Crear nuevo rol */
export async function createRole(
    name: string,
    publicName: string
): Promise<number | null> {
    const [res] = await pool.execute<ResultSetHeader>(
        `INSERT INTO roles (name, public_name) VALUES (?, ?)`,
        [name, publicName]
    )
    return res.insertId || null
}

/** Actualizar rol */
export async function updateRole(
    id: number,
    name: string,
    publicName: string
): Promise<void> {
    await pool.execute(
        'UPDATE roles SET name = ?, public_name = ?, updated_at = NOW() WHERE id = ?',
        [name, publicName, id]
    )
}

/** Eliminar rol */
export async function deleteRole(id: number): Promise<void> {
    await pool.execute(
        'DELETE FROM roles WHERE id = ?',
        [id]
    )
}

/** Verificar si existe un rol con ese nombre (útil para validaciones) */
export async function roleNameExists(name: string, excludeId?: number): Promise<boolean> {
    let query = 'SELECT 1 FROM roles WHERE name = ?'
    const params: any[] = [name]
    
    if (excludeId) {
        query += ' AND id != ?'
        params.push(excludeId)
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params)
    return rows.length > 0
}