import type { FastifyRequest, FastifyReply } from 'fastify'
import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { findUserById, findUserByUsername, updateUser as updateUserModel, softDeleteUser } from '../models/user.js'
import { findUserTypeById } from '../models/userType.js'
import { getDiscoveredSpeciesByUser } from '../models/species.js'
import { getUserTimeline, getUserStreak, getStreakRanking } from '../models/userActionHistory.js'
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
        exp: u.exp,
        level: u.level,
        type_app: u.type_app,
        created_at: u.created_at,
        updated_at: u.updated_at
    }
}

/** GET /users - Listar usuarios (público para rankings, búsqueda para etiquetas) */
export async function listUsers(req: FastifyRequest, reply: FastifyReply) {
    const page = Math.max(1, Number((req.query as any)?.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any)?.pageSize ?? 20)))
    const offset = (page - 1) * pageSize

    const orderBy = (req.query as any)?.orderBy === 'exp' ? 'exp DESC' : 'id ASC'
    const search = (req.query as any)?.search as string | undefined

    // Obtener el usuario autenticado para excluirlo de los resultados
    const currentUserId = (req as any).user?.id ?? null

    // Construir condiciones WHERE dinámicamente
    const conditions: string[] = ['deleted_at IS NULL']
    const params: any[] = []

    // Excluir al usuario actual (no puede etiquetarse a sí mismo)
    if (currentUserId) {
        conditions.push('id != ?')
        params.push(currentUserId)
    }

    // Búsqueda por username o name
    if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`
        conditions.push('(username LIKE ? OR name LIKE ?)')
        params.push(term, term)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows] = await pool.query<(RowDataPacket & User)[]>(
        `SELECT id, firebase_uid, username, name, image, user_type_id, exp, level, created_at, updated_at
         FROM users
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    )

    const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM users ${whereClause}`,
        params
    )
    const total = Number((countRows as any)[0].total)

    return reply.send({
        page,
        pageSize,
        total,
        data: rows
    })
}

/** GET /users/ranking - Top 10 users by nivel y experiencia */
export async function getRanking(req: FastifyRequest, reply: FastifyReply) {
    const [rows] = await pool.query<(RowDataPacket & User)[]>(
        `SELECT id, firebase_uid, username, name, image, user_type_id, exp, level, created_at, updated_at
         FROM users
         ORDER BY level DESC, exp DESC
         LIMIT 10`
    )

    return reply.send({
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

/** GET /users/me/discovered-species - Ver especies descubiertas por el usuario logeado */
export async function getDiscoveredSpecies(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).user
    const userId = auth.id

    try {
        const species = await getDiscoveredSpeciesByUser(userId)
        return reply.send({ data: species })
    } catch (err: any) {
        console.error('Error obteniendo especies descubiertas:', err)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

/** GET /users/me/timeline - Línea de vida unificada (notificaciones + trofeos) */
export async function getMyTimeline(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).user
    const userId = auth.id

    try {
        // 1. Traer notificaciones reclamadas (hitos cumplidos)
        const [notifRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                n.id,
                n.created_at as date,
                n.is_claimed,
                n.data,
                nt.key as n_key,
                nt.title,
                nt.body
             FROM notifications n
             INNER JOIN notification_types nt ON nt.id = n.notification_type_id
             WHERE n.user_id = ?
             ORDER BY n.created_at DESC`,
            [userId]
        )

        // 2. Traer trofeos desbloqueados
        const [trophyRows] = await pool.query<RowDataPacket[]>(
            `SELECT 
                ut.id,
                ut.unlocked_at as date,
                ut.is_claimed,
                t.key as trophy_key,
                t.name,
                t.description,
                t.exp_reward,
                t.rarity
             FROM user_trophies ut
             INNER JOIN trophies t ON t.id = ut.trophy_id
             WHERE ut.user_id = ?
             ORDER BY ut.unlocked_at DESC`,
            [userId]
        )

        // 3. Mapear notificaciones al formato unificado
        const notifItems = notifRows.map((n: any) => {
            let dataObj: any = {}
            if (typeof n.data === 'string') {
                try { dataObj = JSON.parse(n.data) } catch (e) { }
            } else if (n.data) {
                dataObj = n.data
            }

            // Reemplazo de variables en el body
            let finalBody = (n.body || '').replace(/\{([^}]+)\}/g, (match: string, key: string) => {
                return dataObj[key] !== undefined ? dataObj[key] : match
            })

            return {
                source: 'notification',
                title: n.title || '',
                description: finalBody,
                exp_earned: dataObj.prizeAmount || 0,
                date: n.date,
                is_claimed: Boolean(n.is_claimed),
                rarity: null
            }
        })

        // 4. Mapear trofeos al formato unificado
        const trophyItems = trophyRows.map((t: any) => ({
            source: 'trophy',
            title: t.name,
            description: t.description,
            exp_earned: t.exp_reward,
            date: t.date,
            is_claimed: Boolean(t.is_claimed),
            rarity: t.rarity
        }))

        // 5. Mezclar y ordenar por fecha descendente
        const timeline = [...notifItems, ...trophyItems].sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime()
        })

        return reply.send({ data: timeline })
    } catch (err: any) {
        console.error('Error obteniendo timeline:', err)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

/** GET /users/me/streak - Racha de días consecutivos del usuario logueado */
export async function getMyStreak(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).user

    try {
        const streak = await getUserStreak(auth.id)
        return reply.send({ data: { streak } })
    } catch (err: any) {
        console.error('Error obteniendo streak:', err)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

/** GET /users/streak-ranking - Ranking de rachas de días conectados */
export async function getStreakLeaderboard(req: FastifyRequest, reply: FastifyReply) {
    const limit = Math.min(50, Math.max(1, Number((req.query as any)?.limit ?? 20)))

    try {
        const ranking = await getStreakRanking(limit)
        return reply.send({ data: ranking })
    } catch (err: any) {
        console.error('Error obteniendo streak ranking:', err)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}

/** DELETE /users/me - Eliminar cuenta lógicamente (soft delete) */
export async function deleteMe(req: FastifyRequest, reply: FastifyReply) {
    const auth = (req as any).user
    const userId = auth.id

    try {
        const success = await softDeleteUser(userId)

        if (!success) {
            return reply.code(500).send({ message: 'Error eliminando cuenta' })
        }

        return reply.send({ message: 'Cuenta eliminada exitosamente' })
    } catch (err: any) {
        console.error('Error eliminando cuenta:', err)
        return reply.code(500).send({ message: 'Error interno del servidor' })
    }
}