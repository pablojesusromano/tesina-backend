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

/** GET /admins/screen-time - Tiempo en pantalla agrupado por usuario y pantalla */
export async function listScreenTime(req: FastifyRequest, reply: FastifyReply) {
    try {
        const db = admin.firestore();

        // 1. Obtener todas las sesiones de Firestore
        const sessionsSnapshot = await db.collectionGroup('sessions').get();

        // 2. Agrupar por userId + screen
        const grouped = new Map<string, { userId: string; screen: string; totalSeconds: number; sessions: number }>();

        sessionsSnapshot.forEach(sessionDoc => {
            const data = sessionDoc.data();
            const userId = sessionDoc.ref.parent.parent?.id;
            if (!userId) return;

            const screen = data.screen ?? 'unknown';
            const key = `${userId}::${screen}`;
            const existing = grouped.get(key);

            if (existing) {
                existing.totalSeconds += data.durationSeconds ?? 0;
                existing.sessions += 1;
            } else {
                grouped.set(key, {
                    userId,
                    screen,
                    totalSeconds: data.durationSeconds ?? 0,
                    sessions: 1,
                });
            }
        });

        // 3. Obtener los usernames desde MySQL
        const uniqueUids = [...new Set([...grouped.values()].map(g => g.userId))];
        const userMap = new Map<string, { username: string; name: string; typeApp: number }>();

        if (uniqueUids.length > 0) {
            const placeholders = uniqueUids.map(() => '?').join(',');
            const [rows] = await pool.execute<UserRow[]>(
                `SELECT firebase_uid, username, name, type_app FROM users WHERE firebase_uid IN (${placeholders})`,
                uniqueUids
            );
            for (const row of rows) {
                userMap.set(row.firebase_uid, {
                    username: row.username ?? 'sin-username',
                    name: row.name ?? '',
                    typeApp: row.type_app ?? 0,
                });
            }
        }

        // 4. Construir respuesta
        const data = [...grouped.values()]
            .map(g => ({
                userId: g.userId,
                username: userMap.get(g.userId)?.username ?? g.userId.slice(0, 8),
                name: userMap.get(g.userId)?.name ?? '',
                typeApp: userMap.get(g.userId)?.typeApp ?? 0,
                screen: g.screen,
                totalSeconds: g.totalSeconds,
                sessions: g.sessions,
            }))
            .sort((a, b) => b.totalSeconds - a.totalSeconds);

        return reply.send({
            total: data.length,
            data,
        });
    } catch (err: any) {
        req.log.error(err, 'Error consultando screen_time en Firestore');
        return reply.code(500).send({
            message: 'Error consultando datos de Firestore',
            error: err?.message || String(err),
        });
    }
}