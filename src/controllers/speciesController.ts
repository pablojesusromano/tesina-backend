import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    createSpecies,
    getAllSpecies,
    findSpeciesById,
    findSpeciesByName,
    searchSpecies,
    getSpeciesByMonth,
    updateSpecies,
    deleteSpecies,
    speciesNameExists,
    countAllSpecies,
    hasAssociatedPosts
} from '../models/species.js'

// ==================== CREAR ESPECIE (SOLO ADMINS) ====================
export async function createNewSpecies(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as {
        name: string
        description: string
        how_to_recognise: string
        curious_info?: string
        sighting_start_month?: number
        sighting_end_month?: number
        high_season_specimens?: number
    }

    try {
        // Verificar si ya existe una especie con ese nombre
        const exists = await speciesNameExists(body.name)
        if (exists) {
            return reply.code(409).send({ 
                message: 'Ya existe una especie con ese nombre' 
            })
        }

        const speciesId = await createSpecies(body)

        if (!speciesId) {
            return reply.code(500).send({ message: 'Error creando especie' })
        }

        const newSpecies = await findSpeciesById(speciesId)

        return reply.code(201).send({
            message: 'Especie creada exitosamente',
            species: newSpecies
        })
    } catch (error) {
        console.error('Error creando especie:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== LISTAR ESPECIES (TODOS) ====================
export async function listSpecies(req: FastifyRequest, reply: FastifyReply) {
    const { page = 1, pageSize = 50, search, month } = req.query as {
        page?: number
        pageSize?: number
        search?: string
        month?: number
    }

    try {
        let species
        let total

        // Búsqueda por texto
        if (search && search.trim()) {
            species = await searchSpecies(search.trim())
            total = species.length
            return reply.send({
                page: 1,
                pageSize: total,
                total,
                totalPages: 1,
                species
            })
        }

        // Filtrar por mes
        if (month && month >= 1 && month <= 12) {
            species = await getSpeciesByMonth(Number(month))
            total = species.length
            return reply.send({
                page: 1,
                pageSize: total,
                total,
                totalPages: 1,
                species
            })
        }

        // Listado normal con paginación
        const validPage = Math.max(1, Number(page))
        const validPageSize = Math.min(100, Math.max(1, Number(pageSize)))
        const offset = (validPage - 1) * validPageSize

        species = await getAllSpecies(validPageSize, offset)
        total = await countAllSpecies()

        return reply.send({
            page: validPage,
            pageSize: validPageSize,
            total,
            totalPages: Math.ceil(total / validPageSize),
            species
        })
    } catch (error) {
        console.error('Error obteniendo especies:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== OBTENER ESPECIE POR ID (TODOS) ====================
export async function getSpeciesById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const speciesId = Number(id)

    try {
        const species = await findSpeciesById(speciesId)

        if (!species) {
            return reply.code(404).send({ message: 'Especie no encontrada' })
        }

        return reply.send({ species })
    } catch (error) {
        console.error('Error obteniendo especie:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== ACTUALIZAR ESPECIE (SOLO ADMINS) ====================
export async function updateSpeciesById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const speciesId = Number(id)

    const body = req.body as {
        name?: string
        description?: string
        how_to_recognise?: string
        curious_info?: string
        sighting_start_month?: number
        sighting_end_month?: number
        high_season_specimens?: number
    }

    try {
        // Verificar que la especie existe
        const species = await findSpeciesById(speciesId)
        if (!species) {
            return reply.code(404).send({ message: 'Especie no encontrada' })
        }

        // Si se está cambiando el nombre, verificar que no exista
        if (body.name && body.name !== species.name) {
            const exists = await speciesNameExists(body.name, speciesId)
            if (exists) {
                return reply.code(409).send({ 
                    message: 'Ya existe otra especie con ese nombre' 
                })
            }
        }

        const success = await updateSpecies(speciesId, body)

        if (!success) {
            return reply.code(500).send({ message: 'Error actualizando especie' })
        }

        const updatedSpecies = await findSpeciesById(speciesId)

        return reply.send({
            message: 'Especie actualizada exitosamente',
            species: updatedSpecies
        })
    } catch (error) {
        console.error('Error actualizando especie:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// ==================== ELIMINAR ESPECIE (SOLO ADMINS) ====================
export async function deleteSpeciesById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const speciesId = Number(id)

    try {
        // Verificar que la especie existe
        const species = await findSpeciesById(speciesId)
        if (!species) {
            return reply.code(404).send({ message: 'Especie no encontrada' })
        }

        // Verificar que no tenga posts asociados
        const hasPosts = await hasAssociatedPosts(speciesId)
        if (hasPosts) {
            return reply.code(400).send({ 
                message: 'No se puede eliminar la especie porque tiene publicaciones asociadas' 
            })
        }

        const success = await deleteSpecies(speciesId)

        if (!success) {
            return reply.code(500).send({ message: 'Error eliminando especie' })
        }

        return reply.send({ message: 'Especie eliminada exitosamente' })
    } catch (error: any) {
        console.error('Error eliminando especie:', error)
        
        // Manejar error de foreign key constraint
        if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
            return reply.code(400).send({ 
                message: 'No se puede eliminar la especie porque tiene publicaciones asociadas' 
            })
        }
        
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}