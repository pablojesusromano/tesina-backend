import type { FastifyInstance } from 'fastify'
import { getDashboard, exportData } from '../controllers/analyticsController.js'
import { protectAdminRoute } from '../middlewares/authMiddleware.js'

export default async function analyticsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', protectAdminRoute)

    // GET /api/analytics
    // Query params opcionales:
    //   days  → rango de días para posts por día (default 30, max 365)
    //   top   → cantidad de especies top (default 10, max 50)
    app.get('/', getDashboard)

    // GET /api/analytics/export
    // Query params:
    //   format        → json | csv | geojson (default json)
    //   statuses      → estados separados por coma (default ACTIVO)
    //   specie_id     → filtrar por especie
    //   season_start  → mes inicio 1-12 (requiere season_end)
    //   season_end    → mes fin 1-12 (requiere season_start)
    //   research_only → true | 1 para solo posts marcados para investigación
    app.get('/export', exportData)
}
