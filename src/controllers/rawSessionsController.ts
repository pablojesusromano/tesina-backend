import admin from 'firebase-admin'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'

interface UserRow extends RowDataPacket {
    firebase_uid: string
    username: string | null
    name: string | null
    type_app: number
}

/**
 * GET /admins/screen-time/raw
 * Devuelve cada sesión individual sin agregar, con su fecha y duración.
 * Se usa para calcular retención, frecuencia y duración promedio real de sesión.
 *
 * Respuesta: { total: number, data: SessionRecord[] }
 *
 * Estructura de cada registro:
 *   userId, username, name, typeApp,
 *   screen, date (yyyy-MM-dd), durationSeconds, startedAt (ISO string)
 */
export async function listRawSessions(req: FastifyRequest, reply: FastifyReply) {
    try {
        const db = admin.firestore()

        // 1. Obtener todas las sesiones individuales de Firestore
        const sessionsSnapshot = await db.collectionGroup('sessions').get()

        // 2. Mapear cada documento sin agregar
        const rawSessions: {
            userId: string
            screen: string
            date: string
            durationSeconds: number
            startedAt: string
        }[] = []

        sessionsSnapshot.forEach(sessionDoc => {
            const data = sessionDoc.data()
            const userId = sessionDoc.ref.parent.parent?.id
            if (!userId) return

            rawSessions.push({
                userId,
                screen:          data.screen          ?? 'unknown',
                date:            data.date             ?? '',
                durationSeconds: data.durationSeconds  ?? 0,
                startedAt:       data.startedAt?.toDate?.()?.toISOString() ?? '',
            })
        })

        // 3. Obtener usernames y type_app desde MySQL
        const uniqueUids = [...new Set(rawSessions.map(s => s.userId))]
        const userMap = new Map<string, { username: string; name: string; typeApp: number }>()

        if (uniqueUids.length > 0) {
            const placeholders = uniqueUids.map(() => '?').join(',')
            const [rows] = await pool.execute<UserRow[]>(
                `SELECT firebase_uid, username, name, type_app
                 FROM users
                 WHERE firebase_uid IN (${placeholders})`,
                uniqueUids
            )
            for (const row of rows) {
                userMap.set(row.firebase_uid, {
                    username: row.username ?? 'sin-username',
                    name:     row.name     ?? '',
                    typeApp:  row.type_app ?? 0,
                })
            }
        }

        // 4. Construir respuesta final
        const data = rawSessions
            .map(s => ({
                userId:          s.userId,
                username:        userMap.get(s.userId)?.username ?? s.userId.slice(0, 8),
                name:            userMap.get(s.userId)?.name     ?? '',
                typeApp:         userMap.get(s.userId)?.typeApp  ?? 0,
                screen:          s.screen,
                date:            s.date,
                durationSeconds: s.durationSeconds,
                startedAt:       s.startedAt,
            }))
            .sort((a, b) => a.userId.localeCompare(b.userId) || a.date.localeCompare(b.date))

        return reply.send({
            total: data.length,
            data,
        })

    } catch (err: any) {
        req.log.error(err, 'Error consultando raw sessions en Firestore')
        return reply.code(500).send({
            message: 'Error consultando datos de Firestore',
            error: err?.message || String(err),
        })
    }
}