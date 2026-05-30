import type { FastifyInstance } from 'fastify'
import { getHeatmap } from '../controllers/heatmapController.js'
import { protectAdminRoute } from '../middlewares/authMiddleware.js'

export default async function heatmapRoutes(app: FastifyInstance) {
    app.addHook('preHandler', protectAdminRoute)

    // GET /api/heatmap - Datos de avistamientos con coordenadas para mapa de calor
    // Query params opcionales:
    //   specie_id     → filtrar por especie (ej: 3)
    //   statuses      → estados separados por coma (ej: ACTIVO,REVISION)
    //   season_start  → mes inicio temporada 1-12 (requiere season_end)
    //   season_end    → mes fin temporada 1-12 (requiere season_start)
    app.get('/', getHeatmap)
}
