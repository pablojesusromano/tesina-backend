import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    getAllUserTypes,
    findUserTypeById,
    findUserTypeByName,
    createUserType,
    updateUserType,
    deleteUserType,
    userTypeNameExists,
    getCommonUserTypes
} from '../models/userType'

// GET /user-types - Obtener todos los tipos de usuario
export async function getUserTypes(_req: FastifyRequest, reply: FastifyReply) {
    try {
        const userTypes = await getAllUserTypes()
        return reply.send({ userTypes })
    } catch (error) {
        console.error('Error obteniendo tipos de usuario:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// GET /user-types/common - Obtener tipos comunes
export async function getCommonTypes(_req: FastifyRequest, reply: FastifyReply) {
    try {
        const userTypes = await getCommonUserTypes()
        return reply.send({ userTypes })
    } catch (error) {
        console.error('Error obteniendo tipos comunes:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// GET /user-types/:id - Obtener tipo de usuario por ID
export async function getUserTypeById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userTypeId = parseInt(id)
    
    if (isNaN(userTypeId) || userTypeId <= 0) {
        return reply.code(400).send({ message: 'ID de tipo de usuario inválido' })
    }

    try {
        const userType = await findUserTypeById(userTypeId)
        if (!userType) {
            return reply.code(404).send({ message: 'Tipo de usuario no encontrado' })
        }
        return reply.send({ userType })
    } catch (error) {
        console.error('Error obteniendo tipo de usuario:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// POST /user-types - Crear nuevo tipo de usuario
export async function createNewUserType(req: FastifyRequest, reply: FastifyReply) {
    // @ts-ignore (validado por Zod)
    const { name, public_name } = req.body as { name: string; public_name: string }

    try {
        // Verificar si ya existe un tipo con ese nombre
        const exists = await userTypeNameExists(name)
        if (exists) {
            return reply.code(400).send({ message: 'Ya existe un tipo de usuario con ese nombre' })
        }

        const userTypeId = await createUserType(name, public_name)
        if (!userTypeId) {
            return reply.code(500).send({ message: 'Error creando tipo de usuario' })
        }

        const newUserType = await findUserTypeById(userTypeId)
        return reply.code(201).send({ 
            message: 'Tipo de usuario creado exitosamente', 
            userType: newUserType 
        })
    } catch (error) {
        console.error('Error creando tipo de usuario:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// PUT /user-types/:id - Actualizar tipo de usuario
export async function updateUserTypeById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userTypeId = parseInt(id)
    
    if (isNaN(userTypeId) || userTypeId <= 0) {
        return reply.code(400).send({ message: 'ID de tipo de usuario inválido' })
    }

    // @ts-ignore (validado por Zod)
    const { name, public_name } = req.body as { name: string; public_name: string }

    try {
        // Verificar si el tipo existe
        const userType = await findUserTypeById(userTypeId)
        if (!userType) {
            return reply.code(404).send({ message: 'Tipo de usuario no encontrado' })
        }

        // Verificar si ya existe otro tipo con ese nombre
        const exists = await userTypeNameExists(name, userTypeId)
        if (exists) {
            return reply.code(400).send({ message: 'Ya existe un tipo de usuario con ese nombre' })
        }

        await updateUserType(userTypeId, name, public_name)
        const updatedUserType = await findUserTypeById(userTypeId)
        
        return reply.send({ 
            message: 'Tipo de usuario actualizado exitosamente', 
            userType: updatedUserType 
        })
    } catch (error) {
        console.error('Error actualizando tipo de usuario:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// DELETE /user-types/:id - Eliminar tipo de usuario
export async function deleteUserTypeById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userTypeId = parseInt(id)
    
    if (isNaN(userTypeId) || userTypeId <= 0) {
        return reply.code(400).send({ message: 'ID de tipo de usuario inválido' })
    }

    try {
        // Verificar si el tipo existe
        const userType = await findUserTypeById(userTypeId)
        if (!userType) {
            return reply.code(404).send({ message: 'Tipo de usuario no encontrado' })
        }

        // Verificar que no sea el tipo básico (ID 1)
        if (userTypeId === 1) {
            return reply.code(400).send({ message: 'No se puede eliminar el tipo básico de usuario' })
        }

        await deleteUserType(userTypeId)
        return reply.send({ message: 'Tipo de usuario eliminado exitosamente' })
    } catch (error) {
        console.error('Error eliminando tipo de usuario:', error)
        // Si es error de constraint (usuarios asignados), devolver mensaje apropiado
        if (error instanceof Error && error.message.includes('foreign key')) {
            return reply.code(400).send({ 
                message: 'No se puede eliminar el tipo porque hay usuarios asignados a él' 
            })
        }
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}