import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    getAllRoles,
    findRoleById,
    findRoleByName,
    createRole,
    updateRole,
    deleteRole,
    roleNameExists
} from '../models/userRole.js'

// GET /roles - Obtener todos los roles
export async function getRoles(_req: FastifyRequest, reply: FastifyReply) {
    try {
        const roles = await getAllRoles()
        return reply.send({ roles })
    } catch (error) {
        console.error('Error obteniendo roles:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// GET /roles/:id - Obtener rol por ID
export async function getRoleById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const roleId = parseInt(id)
    
    if (isNaN(roleId) || roleId <= 0) {
        return reply.code(400).send({ message: 'ID de rol inválido' })
    }

    try {
        const role = await findRoleById(roleId)
        if (!role) {
            return reply.code(404).send({ message: 'Rol no encontrado' })
        }
        return reply.send({ role })
    } catch (error) {
        console.error('Error obteniendo rol:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// POST /roles - Crear nuevo rol
export async function createNewRole(req: FastifyRequest, reply: FastifyReply) {
    // @ts-ignore (validado por Zod)
    const { name, public_name } = req.body as { name: string; public_name: string }

    try {
        // Verificar si ya existe un rol con ese nombre
        const exists = await roleNameExists(name)
        if (exists) {
            return reply.code(400).send({ message: 'Ya existe un rol con ese nombre' })
        }

        const roleId = await createRole(name, public_name)
        if (!roleId) {
            return reply.code(500).send({ message: 'Error creando rol' })
        }

        const newRole = await findRoleById(roleId)
        return reply.code(201).send({ 
            message: 'Rol creado exitosamente', 
            role: newRole 
        })
    } catch (error) {
        console.error('Error creando rol:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// PUT /roles/:id - Actualizar rol
export async function updateRoleById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const roleId = parseInt(id)
    
    if (isNaN(roleId) || roleId <= 0) {
        return reply.code(400).send({ message: 'ID de rol inválido' })
    }

    // @ts-ignore (validado por Zod)
    const { name, public_name } = req.body as { name: string; public_name: string }

    try {
        // Verificar si el rol existe
        const role = await findRoleById(roleId)
        if (!role) {
            return reply.code(404).send({ message: 'Rol no encontrado' })
        }

        // Verificar si ya existe otro rol con ese nombre
        const exists = await roleNameExists(name, roleId)
        if (exists) {
            return reply.code(400).send({ message: 'Ya existe un rol con ese nombre' })
        }

        await updateRole(roleId, name, public_name)
        const updatedRole = await findRoleById(roleId)
        
        return reply.send({ 
            message: 'Rol actualizado exitosamente', 
            role: updatedRole 
        })
    } catch (error) {
        console.error('Error actualizando rol:', error)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

// DELETE /roles/:id - Eliminar rol
export async function deleteRoleById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const roleId = parseInt(id)
    
    if (isNaN(roleId) || roleId <= 0) {
        return reply.code(400).send({ message: 'ID de rol inválido' })
    }

    try {
        // Verificar si el rol existe
        const role = await findRoleById(roleId)
        if (!role) {
            return reply.code(404).send({ message: 'Rol no encontrado' })
        }

        // Verificar que no sea el rol básico (ID 1)
        if (roleId === 1) {
            return reply.code(400).send({ message: 'No se puede eliminar el rol básico de usuario' })
        }

        await deleteRole(roleId)
        return reply.send({ message: 'Rol eliminado exitosamente' })
    } catch (error) {
        console.error('Error eliminando rol:', error)
        // Si es error de constraint (usuarios asignados), devolver mensaje apropiado
        if (error instanceof Error && error.message.includes('foreign key')) {
            return reply.code(400).send({ 
                message: 'No se puede eliminar el rol porque hay usuarios asignados a él' 
            })
        }
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}