import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface Species {
    id: number
    name: string
    description: string
    how_to_recognise: string
    curious_info: string | null
    sighting_start_month: number | null
    sighting_end_month: number | null
    high_season_specimens: number | null
    created_at: Date
    updated_at: Date
}

// ==================== CREAR ESPECIE ====================
export async function createSpecies(data: {
    name: string
    description: string
    how_to_recognise: string
    curious_info?: string
    sighting_start_month?: number
    sighting_end_month?: number
    high_season_specimens?: number
}): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO species (
                name, 
                description, 
                how_to_recognise, 
                curious_info,
                sighting_start_month,
                sighting_end_month,
                high_season_specimens
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                data.name,
                data.description,
                data.how_to_recognise,
                data.curious_info || null,
                data.sighting_start_month || null,
                data.sighting_end_month || null,
                data.high_season_specimens || null
            ]
        )
        return result.insertId
    } catch (error) {
        console.error('Error creando especie:', error)
        return null
    }
}

// ==================== OBTENER TODAS LAS ESPECIES ====================
export async function getAllSpecies(
    limit: number = 50,
    offset: number = 0
): Promise<Species[]> {
    const [rows] = await pool.query<(RowDataPacket & Species)[]>(
        `SELECT * FROM species 
         ORDER BY name ASC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
    )
    return rows
}

// ==================== OBTENER ESPECIE POR ID ====================
export async function findSpeciesById(speciesId: number): Promise<Species | null> {
    const [rows] = await pool.query<(RowDataPacket & Species)[]>(
        'SELECT * FROM species WHERE id = ?',
        [speciesId]
    )
    return rows[0] ?? null
}

// ==================== OBTENER ESPECIE POR NOMBRE ====================
export async function findSpeciesByName(name: string): Promise<Species | null> {
    const [rows] = await pool.query<(RowDataPacket & Species)[]>(
        'SELECT * FROM species WHERE name = ?',
        [name]
    )
    return rows[0] ?? null
}

// ==================== BUSCAR ESPECIES POR TEXTO ====================
export async function searchSpecies(searchTerm: string): Promise<Species[]> {
    const [rows] = await pool.query<(RowDataPacket & Species)[]>(
        `SELECT * FROM species 
         WHERE name LIKE ? 
            OR description LIKE ?
            OR how_to_recognise LIKE ?
         ORDER BY name ASC`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
    )
    return rows
}

// ==================== OBTENER ESPECIES POR MES ====================
export async function getSpeciesByMonth(month: number): Promise<Species[]> {
    const [rows] = await pool.query<(RowDataPacket & Species)[]>(
        `SELECT * FROM species 
         WHERE (sighting_start_month <= ? AND sighting_end_month >= ?)
            OR (sighting_start_month <= ? AND sighting_end_month IS NULL)
            OR (sighting_start_month IS NULL AND sighting_end_month >= ?)
            OR (sighting_start_month IS NULL AND sighting_end_month IS NULL)
         ORDER BY name ASC`,
        [month, month, month, month]
    )
    return rows
}

// ==================== ACTUALIZAR ESPECIE ====================
export async function updateSpecies(
    speciesId: number,
    data: Partial<Omit<Species, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
    try {
        const updates: string[] = []
        const values: any[] = []

        if (data.name !== undefined) {
            updates.push('name = ?')
            values.push(data.name)
        }
        if (data.description !== undefined) {
            updates.push('description = ?')
            values.push(data.description)
        }
        if (data.how_to_recognise !== undefined) {
            updates.push('how_to_recognise = ?')
            values.push(data.how_to_recognise)
        }
        if (data.curious_info !== undefined) {
            updates.push('curious_info = ?')
            values.push(data.curious_info || null)
        }
        if (data.sighting_start_month !== undefined) {
            updates.push('sighting_start_month = ?')
            values.push(data.sighting_start_month || null)
        }
        if (data.sighting_end_month !== undefined) {
            updates.push('sighting_end_month = ?')
            values.push(data.sighting_end_month || null)
        }
        if (data.high_season_specimens !== undefined) {
            updates.push('high_season_specimens = ?')
            values.push(data.high_season_specimens || null)
        }

        if (updates.length === 0) return false

        values.push(speciesId)

        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE species SET ${updates.join(', ')} WHERE id = ?`,
            values
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error actualizando especie:', error)
        return false
    }
}

// ==================== ELIMINAR ESPECIE ====================
export async function deleteSpecies(speciesId: number): Promise<boolean> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM species WHERE id = ?',
            [speciesId]
        )
        return result.affectedRows > 0
    } catch (error) {
        console.error('Error eliminando especie:', error)
        return false
    }
}

// ==================== VERIFICAR SI EXISTE NOMBRE ====================
export async function speciesNameExists(name: string, excludeId?: number): Promise<boolean> {
    const query = excludeId 
        ? 'SELECT id FROM species WHERE name = ? AND id != ?'
        : 'SELECT id FROM species WHERE name = ?'
    
    const params = excludeId ? [name, excludeId] : [name]
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params)
    return rows.length > 0
}

// ==================== CONTAR ESPECIES ====================
export async function countAllSpecies(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM species'
    )
    return rows[0]?.total ?? 0
}

// ==================== VERIFICAR SI HAY POSTS ASOCIADOS ====================
export async function hasAssociatedPosts(speciesId: number): Promise<boolean> {
    // Por ahora retorna false
    // const [rows] = await pool.query<RowDataPacket[]>(
    //     'SELECT COUNT(*) as total FROM post_species WHERE species_id = ?',
    //     [speciesId]
    // )
    // return rows[0]?.total > 0
    return false
}