import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'
import { resolveStatusIds, type PostStatusName } from './postStatus.js'

export interface HeatmapPoint {
    post_id: number
    latitude: number
    longitude: number
    specie_id: number | null
    specie_name: string | null
    specie_category: string | null
    status: PostStatusName
    watched_at: Date | null
    title: string
}

export interface HeatmapFilters {
    specieId?: number | undefined
    statuses?: PostStatusName[] | undefined
    seasonStart?: number | undefined
    seasonEnd?: number | undefined
}

export async function getHeatmapData(filters: HeatmapFilters = {}): Promise<HeatmapPoint[]> {
    const {
        specieId,
        statuses = ['BORRADOR', 'ACTIVO', 'REVISION', 'RECHAZADO'],
        seasonStart,
        seasonEnd
    } = filters

    const statusIds = await resolveStatusIds(statuses)
    if (!statusIds.length) return []

    const conditions: string[] = [`ps.id IN (${statusIds.map(() => '?').join(', ')})`]
    const params: any[] = [...statusIds]

    if (specieId !== undefined) {
        conditions.push('p.specie_id = ?')
        params.push(specieId)
    }

    if (seasonStart !== undefined && seasonEnd !== undefined) {
        if (seasonStart <= seasonEnd) {
            conditions.push('MONTH(p.watched_at) BETWEEN ? AND ?')
        } else {
            // Rango que cruza fin de año (ej: noviembre a marzo)
            conditions.push('(MONTH(p.watched_at) >= ? OR MONTH(p.watched_at) <= ?)')
        }
        params.push(seasonStart, seasonEnd)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                p.id AS post_id,
                pi_c.latitude,
                pi_c.longitude,
                p.specie_id,
                s.name AS specie_name,
                s.category AS specie_category,
                ps.name AS status,
                p.watched_at,
                p.title
            FROM posts p
            INNER JOIN post_status ps ON p.status_id = ps.id
            LEFT JOIN species s ON s.id = p.specie_id
            INNER JOIN post_images pi_c ON pi_c.id = (
                SELECT pi2.id
                FROM post_images pi2
                WHERE pi2.post_id = p.id
                  AND pi2.latitude IS NOT NULL
                  AND pi2.longitude IS NOT NULL
                ORDER BY pi2.image_order ASC
                LIMIT 1
            )
            ${whereClause}
            ORDER BY p.watched_at DESC`,
            params
        )
        return rows as HeatmapPoint[]
    } catch (error) {
        console.error('Error obteniendo datos de mapa de calor:', error)
        return []
    }
}
