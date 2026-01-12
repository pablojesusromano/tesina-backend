import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export type DBUserType = {
    id: number
    name: string
    public_name: string
    created_at: Date
    updated_at: Date | null
}

/** Buscar tipo de usuario por ID */
export async function findUserTypeById(id: number): Promise<DBUserType | null> {
    const [rows] = await pool.query<(DBUserType & RowDataPacket)[]>(
        'SELECT * FROM user_types WHERE id = ? LIMIT 1',
        [id]
    )
    return rows[0] ?? null
}

/** Buscar tipo de usuario por name */
export async function findUserTypeByName(name: string): Promise<DBUserType | null> {
    const [rows] = await pool.query<(DBUserType & RowDataPacket)[]>(
        'SELECT * FROM user_types WHERE name = ? LIMIT 1',
        [name]
    )
    return rows[0] ?? null
}

/** Obtener todos los tipos de usuario */
export async function getAllUserTypes(): Promise<DBUserType[]> {
    const [rows] = await pool.query<(DBUserType & RowDataPacket)[]>(
        'SELECT * FROM user_types ORDER BY id ASC'
    )
    return rows
}

/** Crear nuevo tipo de usuario */
export async function createUserType(
    name: string,
    publicName: string
): Promise<number | null> {
    const [res] = await pool.execute<ResultSetHeader>(
        `INSERT INTO user_types (name, public_name) VALUES (?, ?)`,
        [name, publicName]
    )
    return res.insertId || null
}

/** Actualizar tipo de usuario */
export async function updateUserType(
    id: number,
    name: string,
    publicName: string
): Promise<void> {
    await pool.execute(
        'UPDATE user_types SET name = ?, public_name = ?, updated_at = NOW() WHERE id = ?',
        [name, publicName, id]
    )
}

/** Eliminar tipo de usuario */
export async function deleteUserType(id: number): Promise<void> {
    await pool.execute(
        'DELETE FROM user_types WHERE id = ?',
        [id]
    )
}

/** Verificar si existe un tipo de usuario con ese nombre (útil para validaciones) */
export async function userTypeNameExists(name: string, excludeId?: number): Promise<boolean> {
    let query = 'SELECT 1 FROM user_types WHERE name = ?'
    const params: any[] = [name]
    
    if (excludeId) {
        query += ' AND id != ?'
        params.push(excludeId)
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params)
    return rows.length > 0
}

/** Obtener tipos de usuario más comunes para selectores (opcional) */
export async function getCommonUserTypes(): Promise<DBUserType[]> {
    const commonTypes = ['estudiante', 'docente', 'investigador', 'profesional']
    const placeholders = commonTypes.map(() => '?').join(',')
    
    const [rows] = await pool.query<(DBUserType & RowDataPacket)[]>(
        `SELECT * FROM user_types WHERE name IN (${placeholders}) ORDER BY FIELD(name, ${placeholders})`,
        [...commonTypes, ...commonTypes]
    )
    return rows
}

/** Contar usuarios asignados a un tipo específico */
export async function countUsersWithType(userTypeId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM users WHERE user_type_id = ?',
        [userTypeId]
    )
    return rows[0]?.count ?? 0
}

/** Obtener tipos de usuario con conteo de usuarios */
export async function getUserTypesWithCount(): Promise<(DBUserType & { user_count: number })[]> {
    const [rows] = await pool.query<(DBUserType & { user_count: number } & RowDataPacket)[]>(
        `SELECT 
            ut.*,
            COUNT(u.id) as user_count
        FROM user_types ut
        LEFT JOIN users u ON ut.id = u.user_type_id
        GROUP BY ut.id
        ORDER BY ut.id ASC`
    )
    return rows
}