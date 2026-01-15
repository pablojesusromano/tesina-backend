import type { FastifyInstance } from 'fastify'
import {
    createNewSpecies,
    listSpecies,
    getSpeciesById,
    updateSpeciesById,
    deleteSpeciesById
} from '../controllers/speciesController.js'
import { protectAdminRoute } from '../middlewares/authMiddleware.js'
import { protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'
import { 
    validateCreateSpecies, 
    validateUpdateSpecies, 
    validateIdParam 
} from '../middlewares/validateMiddleware.js'

export default async function speciesRoutes(app: FastifyInstance) {
    // ==================== RUTAS PÚBLICAS (autenticadas) ====================
    // Usuarios y admins pueden listar y ver especies
    
    // GET /species - Listar especies (con búsqueda y filtros)
    app.get('/', { preHandler: protectUserOrAdminRoute }, listSpecies)
    
    // GET /species/:id - Ver especie específica
    app.get('/:id', { 
        preHandler: [protectUserOrAdminRoute, validateIdParam] 
    }, getSpeciesById)

    
    // ==================== RUTAS DE GESTIÓN (solo admins) ====================
    
    // POST /species - Crear especie
    app.post('/', { 
        preHandler: [protectAdminRoute, validateCreateSpecies] 
    }, createNewSpecies)
    
    // PATCH /species/:id - Actualizar especie
    app.patch('/:id', {
        preHandler: [protectAdminRoute, validateIdParam, validateUpdateSpecies]
    }, updateSpeciesById)
    
    // DELETE /species/:id - Eliminar especie
    app.delete('/:id', {
        preHandler: [protectAdminRoute, validateIdParam]
    }, deleteSpeciesById)
}