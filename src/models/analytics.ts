import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'
import { resolveStatusIds, type PostStatusName } from './postStatus.js'

// ==================== TIPOS ====================

export interface ParticipationStats {
    total_usuarios: number
    nuevos_7d: number
    nuevos_30d: number
    usuarios_activos_30d: number
    total_posts: number
    posts_validados: number
}

export interface PostsByStatus {
    estado: string
    cantidad: number
}

export interface PostsPerDay {
    fecha: string
    cantidad: number
}

export interface SpecieReportCount {
    specie_id: number
    specie_name: string
    specie_category: string | null
    sighting_start_month: number | null
    sighting_end_month: number | null
    total: number
}

export interface SightingsByMonth {
    mes: number
    cantidad: number
}

export interface ExportRecord {
    post_id: number
    title: string
    description: string
    specie_id: number | null
    specie_name: string | null
    specie_category: string | null
    status: string
    watched_at: Date | null
    latitude: number | null
    longitude: number | null
    used_for_research: boolean
    user_name: string
    user_username: string
    created_at: Date
}

export interface ExportFilters {
    statuses?: PostStatusName[] | undefined
    specieId?: number | undefined
    seasonStart?: number | undefined
    seasonEnd?: number | undefined
    researchOnly?: boolean | undefined
}

// ==================== PARTICIPACIÓN CIUDADANA ====================

export async function getParticipationStats(): Promise<ParticipationStats> {
    const [[userRows], [activeRows], [postRows], [validatedRows]] = await Promise.all([
        pool.query<RowDataPacket[]>(
            `SELECT
                COUNT(*) AS total_usuarios,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS nuevos_7d,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS nuevos_30d
             FROM users
             WHERE deleted_at IS NULL`
        ),
        pool.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT p.user_id) AS usuarios_activos_30d
             FROM posts p
             INNER JOIN post_status ps ON p.status_id = ps.id
             WHERE ps.name != 'ELIMINADO'
               AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        ),
        pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total_posts
             FROM posts p
             INNER JOIN post_status ps ON p.status_id = ps.id
             WHERE ps.name != 'ELIMINADO'`
        ),
        pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS posts_validados
             FROM posts p
             INNER JOIN post_status ps ON p.status_id = ps.id
             WHERE ps.name = 'ACTIVO'`
        )
    ])

    return {
        total_usuarios: userRows[0]?.total_usuarios ?? 0,
        nuevos_7d: userRows[0]?.nuevos_7d ?? 0,
        nuevos_30d: userRows[0]?.nuevos_30d ?? 0,
        usuarios_activos_30d: activeRows[0]?.usuarios_activos_30d ?? 0,
        total_posts: postRows[0]?.total_posts ?? 0,
        posts_validados: validatedRows[0]?.posts_validados ?? 0
    }
}

export async function getPostsCountByStatus(): Promise<PostsByStatus[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ps.name AS estado, COUNT(p.id) AS cantidad
         FROM post_status ps
         LEFT JOIN posts p ON p.status_id = ps.id
         WHERE ps.name != 'ELIMINADO'
         GROUP BY ps.id, ps.name
         ORDER BY cantidad DESC`
    )
    return rows as PostsByStatus[]
}

export async function getPostsPerDay(days: number = 30): Promise<PostsPerDay[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DATE(p.created_at) AS fecha, COUNT(*) AS cantidad
         FROM posts p
         INNER JOIN post_status ps ON p.status_id = ps.id
         WHERE ps.name != 'ELIMINADO'
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(p.created_at)
         ORDER BY fecha ASC`,
        [days]
    )
    return rows.map(r => ({ fecha: String(r.fecha), cantidad: r.cantidad }))
}

// ==================== DINÁMICA BIOLÓGICA ====================

export async function getMostReportedSpecies(limit: number = 10): Promise<SpecieReportCount[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
            s.id AS specie_id,
            s.name AS specie_name,
            s.category AS specie_category,
            s.sighting_start_month,
            s.sighting_end_month,
            COUNT(p.id) AS total
         FROM species s
         LEFT JOIN posts p ON p.specie_id = s.id
            AND p.status_id IN (SELECT id FROM post_status WHERE name != 'ELIMINADO')
         GROUP BY s.id, s.name, s.category, s.sighting_start_month, s.sighting_end_month
         ORDER BY total DESC
         LIMIT ?`,
        [limit]
    )
    return rows as SpecieReportCount[]
}

export async function getSightingsByMonth(): Promise<SightingsByMonth[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT MONTH(p.watched_at) AS mes, COUNT(*) AS cantidad
         FROM posts p
         INNER JOIN post_status ps ON p.status_id = ps.id
         WHERE ps.name != 'ELIMINADO'
           AND p.watched_at IS NOT NULL
         GROUP BY MONTH(p.watched_at)
         ORDER BY mes ASC`
    )
    return rows as SightingsByMonth[]
}

// ==================== EXPORTACIÓN ====================

export async function getExportData(filters: ExportFilters = {}): Promise<ExportRecord[]> {
    const {
        statuses = ['ACTIVO'],
        specieId,
        seasonStart,
        seasonEnd,
        researchOnly = false
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
            conditions.push('(MONTH(p.watched_at) >= ? OR MONTH(p.watched_at) <= ?)')
        }
        params.push(seasonStart, seasonEnd)
    }

    if (researchOnly) {
        conditions.push('p.used_for_research = 1')
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                p.id AS post_id,
                p.title,
                p.description,
                p.specie_id,
                s.name AS specie_name,
                s.category AS specie_category,
                ps.name AS status,
                p.watched_at,
                p.created_at,
                p.used_for_research,
                u.name AS user_name,
                u.username AS user_username,
                (
                    SELECT pi2.latitude
                    FROM post_images pi2
                    WHERE pi2.post_id = p.id AND pi2.latitude IS NOT NULL
                    ORDER BY pi2.image_order ASC LIMIT 1
                ) AS latitude,
                (
                    SELECT pi2.longitude
                    FROM post_images pi2
                    WHERE pi2.post_id = p.id AND pi2.longitude IS NOT NULL
                    ORDER BY pi2.image_order ASC LIMIT 1
                ) AS longitude
             FROM posts p
             INNER JOIN post_status ps ON p.status_id = ps.id
             INNER JOIN users u ON p.user_id = u.id
             LEFT JOIN species s ON s.id = p.specie_id
             ${whereClause}
             ORDER BY p.watched_at DESC`,
            params
        )
        return rows as ExportRecord[]
    } catch (error) {
        console.error('Error obteniendo datos de exportación:', error)
        return []
    }
}
