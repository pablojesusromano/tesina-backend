import type { FastifyRequest, FastifyReply } from 'fastify'
import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { findUserById, findUserByUsername, updateUser as updateUserModel } from '../models/user.js'
import { findUserTypeById } from '../models/userType.js'
import type { User } from '../models/user.js'
import { UPLOADS_BASE_URL_PROFILE, ALLOWED_TYPES, MAX_PROFILE_IMAGE_SIZE } from '../config/upload.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function sanitizeUser(u: User) {
    // Los users ya no tienen datos sensibles, pero por consistencia:
    return {
        id: u.id,
        firebase_uid: u.firebase_uid,
        name: u.name,
        username: u.username,
        image: u.image,
        user_type_id: u.user_type_id,
        points: u.points,
        created_at: u.created_at,
        updated_at: u.updated_at
    }
}

/** GET /users - Listar usuarios (público para rankings) */
export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
    const page = Math.max(1, Number((req.query as any)?.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize ?? 20)))
    const offset = (page - 1) * pageSize

    // Opcional: ordenar por puntos para rankings
    const orderBy = (req.query as any)?.orderBy === 'points' ? 'points DESC' : 'id ASC'

    const [rows] = await pool.query<(RowDataPacket & User)[]>(
        `SELECT id, firebase_uid, username, name, image, user_type_id, points, created_at, updated_at
         FROM users
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [pageSize, offset]
    )

    const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM users'
    )
    const total = Number((countRows as any)[0].total)

    return reply.send({
        page,
        pageSize,
        total,
        data: rows
    })
}

/** GET /users/me - Mi perfil */
export async function getMe(req: FastifyRequest, reply: FastifyReply) {
    const me = (req as any).user
    return reply.send(sanitizeUser(me))
}

/** GET /users/:id - Ver perfil público */
export async function getUserById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string }
    const userId = Number(id)

    const user = await findUserById(userId)
    if (!user) {
        return reply.code(404).send({ message: 'Usuario no encontrado' })
    }

    return reply.send(sanitizeUser(user))
}

/** PATCH /users/me - Actualizar mi perfil (datos + imagen opcional) */
export async function updateUser(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).user
    const userId = auth.id

    try {
        const updateData: Partial<User> = {}
        let uploadedImageUrl: string | null = null

        // Verificar si es multipart (incluye imagen)
        const contentType = req.headers['content-type'] || ''
        
        if (contentType.includes('multipart/form-data')) {
            // Procesar multipart data
            const parts = req.parts()
            
            for await (const part of parts) {
                if (part.type === 'field') {
                    // Campos de texto
                    if (part.fieldname === 'name') {
                        updateData.name = part.value as string
                    } else if (part.fieldname === 'username') {
                        updateData.username = part.value as string
                    } else if (part.fieldname === 'userTypeId') {
                        const userTypeId = Number(part.value)
                        const ut = await findUserTypeById(userTypeId)
                        if (!ut) {
                            return reply.code(400).send({ message: 'userTypeId inválido' })
                        }
                        updateData.user_type_id = ut.id
                    }
                } else {
                    // Es un archivo (imagen)
                    if (uploadedImageUrl) {
                        return reply.code(400).send({ 
                            message: 'Solo se permite una imagen de perfil' 
                        })
                    }

                    // Validar tipo
                    if (!ALLOWED_TYPES.includes(part.mimetype)) {
                        return reply.code(400).send({ 
                            message: 'Tipo de archivo no permitido. Solo JPG, PNG, WebP o HEIC' 
                        })
                    }

                    // Validar tamaño
                    const buffer = await part.toBuffer()
                    if (buffer.length > MAX_PROFILE_IMAGE_SIZE) {
                        return reply.code(400).send({ 
                            message: `La imagen no debe superar ${MAX_PROFILE_IMAGE_SIZE / (1024 * 1024)}MB` 
                        })
                    }

                    // Crear directorio del usuario
                    const userUploadDir = path.join(__dirname, '../..', 'uploads/users', userId.toString())
                    if (!fs.existsSync(userUploadDir)) {
                        fs.mkdirSync(userUploadDir, { recursive: true })
                    }

                    // Eliminar imagen anterior si existe
                    const files = fs.readdirSync(userUploadDir)
                    files.forEach(file => {
                        const filePath = path.join(userUploadDir, file)
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath)
                        }
                    })

                    // Generar nombre con extensión original
                    const ext = path.extname(part.filename)
                    const filename = `profile${ext}`
                    const filepath = path.join(userUploadDir, filename)

                    // Guardar archivo
                    fs.writeFileSync(filepath, buffer)

                    uploadedImageUrl = `${UPLOADS_BASE_URL_PROFILE}/${userId}/${filename}`
                }
            }
        } else {
            // JSON regular (sin imagen)
            const body = (req.body as any) ?? {}
            
            if (body.name !== undefined) updateData.name = body.name
            if (body.username !== undefined) updateData.username = body.username
            if (body.userTypeId !== undefined) {
                const ut = await findUserTypeById(Number(body.userTypeId))
                if (!ut) {
                    return reply.code(400).send({ message: 'userTypeId inválido' })
                }
                updateData.user_type_id = ut.id
            }
        }

        // Si hay imagen, agregarla a updateData
        if (uploadedImageUrl) {
            updateData.image = uploadedImageUrl
        }

        // Validar que hay algo para actualizar
        if (Object.keys(updateData).length === 0) {
            return reply.code(400).send({ message: 'Nada para actualizar' })
        }

        // Actualizar usuario
        const success = await updateUserModel(userId, updateData)
        
        if (!success) {
            // Limpiar imagen si falla
            if (uploadedImageUrl) {
                const userUploadDir = path.join(__dirname, '../../uploads/users', userId.toString())
                if (fs.existsSync(userUploadDir)) {
                    const files = fs.readdirSync(userUploadDir)
                    files.forEach(file => {
                        const filePath = path.join(userUploadDir, file)
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath)
                        }
                    })
                }
            }
            return reply.code(500).send({ message: 'Error actualizando usuario' })
        }

        const updated = await findUserById(userId)
        return reply.send({
            message: 'Usuario actualizado',
            user: sanitizeUser(updated!)
        })
    } catch (err: any) {
        console.error('Error actualizando usuario:', err)
        if (err?.code === 'ER_DUP_ENTRY') {
            return reply.code(409).send({ message: 'Username ya en uso' })
        }
        return reply.code(500).send({ message: 'Error actualizando usuario' })
    }
}