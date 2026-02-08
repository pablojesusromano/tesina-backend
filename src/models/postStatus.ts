import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'

// ==================== TIPOS ====================
export type PostStatusName = 'BORRADOR' | 'ACTIVO' | 'RECHAZADO' | 'ELIMINADO' | 'REVISION'

export interface PostStatus {
    id: number
    name: PostStatusName
    description: string
}

// ==================== CONSTANTES (para referencia y type safety) ====================
export const POST_STATUS_NAMES = {
    BORRADOR:  'BORRADOR',
    ACTIVO:    'ACTIVO',
    RECHAZADO: 'RECHAZADO',
    ELIMINADO: 'ELIMINADO',
    REVISION:  'REVISION'
} as const

// ==================== FUNCIONES ====================

/**
 * Buscar un estado por su nombre
 */
export async function findStatusByName(statusName: PostStatusName): Promise<PostStatus | null> {
    try {
        const [rows] = await pool.query<(RowDataPacket & PostStatus)[]>(
            'SELECT id, name, description FROM post_status WHERE name = ?',
            [statusName]
        )
        const [status] = rows;
        return status ?? null;
    } catch (error) {
        console.error('Error buscando status por nombre:', error)
        return null
    }
}

/**
 * Obtener todos los nombres de estados disponibles desde la BD
 * Esta función se usa para validar estados dinámicamente
 */
export async function getAllStatusNames(): Promise<PostStatusName[]> {
    try {
        const [rows] = await pool.query<(RowDataPacket & { name: PostStatusName })[]>(
            'SELECT name FROM post_status ORDER BY id'
        )
        return rows.map(row => row.name)
    } catch (error) {
        console.error('Error obteniendo nombres de estados:', error)
        // Fallback a los estados conocidos si hay error
        return ['BORRADOR', 'ACTIVO', 'RECHAZADO', 'ELIMINADO', 'REVISION']
    }
}

/**
 * Obtener todos los estados
 */
export async function getAllStatuses(): Promise<PostStatus[]> {
    try {
        const [rows] = await pool.query<(RowDataPacket & PostStatus)[]>(
            'SELECT id, name, description FROM post_status ORDER BY id'
        )
        return rows
    } catch (error) {
        console.error('Error obteniendo estados:', error)
        return []
    }
}

/**
 * Resolver nombres de estados a IDs
 */
export async function resolveStatusIds(statusNames: PostStatusName[]): Promise<number[]> {
    if (!statusNames.length) return []

    try {
        const placeholders = statusNames.map(() => '?').join(', ')
        const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
            `SELECT id FROM post_status WHERE name IN (${placeholders})`,
            statusNames
        )
        return rows.map(row => row.id)
    } catch (error) {
        console.error('Error resolviendo status IDs:', error)
        return []
    }
}