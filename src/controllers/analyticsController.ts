import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    getParticipationStats,
    getPostsCountByStatus,
    getPostsPerDay,
    getMostReportedSpecies,
    getSightingsByMonth,
    getExportData,
    type ExportRecord
} from '../models/analytics.js'
import type { PostStatusName } from '../models/postStatus.js'

const VALID_STATUSES: PostStatusName[] = ['BORRADOR', 'ACTIVO', 'REVISION', 'RECHAZADO', 'ELIMINADO']
const EXPORT_FORMATS = ['json', 'csv', 'geojson'] as const

// ==================== DASHBOARD ====================

export async function getDashboard(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { days?: string; top?: string }

    const days = query.days ? Number(query.days) : 30
    const top = query.top ? Number(query.top) : 10

    if (isNaN(days) || days < 1 || days > 365) {
        return reply.code(400).send({ message: 'days debe ser un número entre 1 y 365' })
    }
    if (isNaN(top) || top < 1 || top > 50) {
        return reply.code(400).send({ message: 'top debe ser un número entre 1 y 50' })
    }

    const [participacion, posts_por_estado, posts_por_dia, especies_mas_reportadas, avistajes_por_mes] =
        await Promise.all([
            getParticipationStats(),
            getPostsCountByStatus(),
            getPostsPerDay(days),
            getMostReportedSpecies(top),
            getSightingsByMonth()
        ])

    return reply.send({
        participacion: {
            ...participacion,
            posts_por_estado,
            posts_por_dia
        },
        dinamica_biologica: {
            especies_mas_reportadas,
            avistajes_por_mes
        }
    })
}

// ==================== EXPORTACIÓN ====================

export async function exportData(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as {
        format?: string
        specie_id?: string
        statuses?: string
        season_start?: string
        season_end?: string
        research_only?: string
    }

    const format = (query.format ?? 'json').toLowerCase()
    if (!EXPORT_FORMATS.includes(format as typeof EXPORT_FORMATS[number])) {
        return reply.code(400).send({ message: `Formato inválido. Use: ${EXPORT_FORMATS.join(', ')}` })
    }

    let specieId: number | undefined
    if (query.specie_id !== undefined) {
        specieId = Number(query.specie_id)
        if (isNaN(specieId) || specieId <= 0) {
            return reply.code(400).send({ message: 'specie_id debe ser un número válido' })
        }
    }

    let statuses: PostStatusName[] | undefined
    if (query.statuses !== undefined) {
        const raw = query.statuses.split(',').map(s => s.trim().toUpperCase())
        const invalid = raw.filter(s => !VALID_STATUSES.includes(s as PostStatusName))
        if (invalid.length) {
            return reply.code(400).send({ message: `Estados inválidos: ${invalid.join(', ')}` })
        }
        statuses = raw as PostStatusName[]
    }

    let seasonStart: number | undefined
    let seasonEnd: number | undefined
    if ((query.season_start !== undefined) !== (query.season_end !== undefined)) {
        return reply.code(400).send({ message: 'Debe proveer season_start y season_end juntos' })
    }
    if (query.season_start !== undefined && query.season_end !== undefined) {
        seasonStart = Number(query.season_start)
        seasonEnd = Number(query.season_end)
        if (
            isNaN(seasonStart) || isNaN(seasonEnd) ||
            seasonStart < 1 || seasonStart > 12 ||
            seasonEnd < 1 || seasonEnd > 12
        ) {
            return reply.code(400).send({ message: 'season_start y season_end deben ser meses entre 1 y 12' })
        }
    }

    const researchOnly = query.research_only === 'true' || query.research_only === '1'

    const records = await getExportData({ statuses, specieId, seasonStart, seasonEnd, researchOnly })

    if (format === 'csv') {
        reply.header('Content-Type', 'text/csv; charset=utf-8')
        reply.header('Content-Disposition', 'attachment; filename="avistamientos.csv"')
        return reply.send(buildCsv(records))
    }

    if (format === 'geojson') {
        reply.header('Content-Type', 'application/geo+json')
        reply.header('Content-Disposition', 'attachment; filename="avistamientos.geojson"')
        return reply.send(buildGeoJson(records))
    }

    // json (default)
    reply.header('Content-Disposition', 'attachment; filename="avistamientos.json"')
    return reply.send(records)
}

// ==================== HELPERS DE FORMATO ====================

function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    const str = value instanceof Date ? value.toISOString() : String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function buildCsv(records: ExportRecord[]): string {
    const headers = [
        'post_id', 'title', 'description', 'specie_name', 'specie_category',
        'status', 'watched_at', 'latitude', 'longitude',
        'used_for_research', 'user_name', 'user_username', 'created_at'
    ]

    const lines = [
        headers.join(','),
        ...records.map(r =>
            [
                r.post_id, r.title, r.description, r.specie_name, r.specie_category,
                r.status,
                r.watched_at ? new Date(r.watched_at).toISOString() : '',
                r.latitude, r.longitude,
                r.used_for_research ? '1' : '0',
                r.user_name, r.user_username,
                new Date(r.created_at).toISOString()
            ].map(escapeCsvValue).join(',')
        )
    ]

    return lines.join('\n')
}

function buildGeoJson(records: ExportRecord[]): object {
    return {
        type: 'FeatureCollection',
        features: records
            .filter(r => r.latitude !== null && r.longitude !== null)
            .map(r => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    // GeoJSON spec: [longitude, latitude]
                    coordinates: [r.longitude, r.latitude]
                },
                properties: {
                    post_id: r.post_id,
                    title: r.title,
                    description: r.description,
                    specie_name: r.specie_name,
                    specie_category: r.specie_category,
                    status: r.status,
                    watched_at: r.watched_at ? new Date(r.watched_at).toISOString() : null,
                    used_for_research: r.used_for_research,
                    user_name: r.user_name,
                    user_username: r.user_username,
                    created_at: new Date(r.created_at).toISOString()
                }
            }))
    }
}
