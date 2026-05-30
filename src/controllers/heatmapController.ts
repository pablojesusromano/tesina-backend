import type { FastifyRequest, FastifyReply } from 'fastify'
import { getHeatmapData } from '../models/heatmap.js'
import type { PostStatusName } from '../models/postStatus.js'

const VALID_STATUSES: PostStatusName[] = ['BORRADOR', 'ACTIVO', 'REVISION', 'RECHAZADO', 'ELIMINADO']

export async function getHeatmap(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as {
        specie_id?: string
        statuses?: string
        season_start?: string
        season_end?: string
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
            return reply.code(400).send({ message: `Estados inválidos: ${invalid.join(', ')}. Válidos: ${VALID_STATUSES.join(', ')}` })
        }
        statuses = raw as PostStatusName[]
    }

    let seasonStart: number | undefined
    let seasonEnd: number | undefined

    const hasStart = query.season_start !== undefined
    const hasEnd = query.season_end !== undefined

    if (hasStart !== hasEnd) {
        return reply.code(400).send({ message: 'Debe proveer season_start y season_end juntos' })
    }

    if (hasStart && hasEnd) {
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

    const data = await getHeatmapData({ specieId, statuses, seasonStart, seasonEnd })
    return reply.send(data)
}
