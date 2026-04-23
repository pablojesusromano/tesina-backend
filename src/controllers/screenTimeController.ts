import type { FastifyRequest, FastifyReply } from 'fastify'
import admin from 'firebase-admin'

/** GET /admins/screen-time - Listar todos los registros de tiempo en pantalla desde Firestore */
export async function listScreenTime(req: FastifyRequest, reply: FastifyReply) {
    try {
        const db = admin.firestore()

        // Obtener los documentos padre de screen_time (los userIds)
        const screenTimeRef = db.collection('screen_time')
        const usersSnapshot = await screenTimeRef.listDocuments()

        const allSessions: any[] = []

        for (const userDocRef of usersSnapshot) {
            const userId = userDocRef.id
            const sessionsSnapshot = await userDocRef
                .collection('sessions')
                .get()

            for (const sessionDoc of sessionsSnapshot.docs) {
                const data = sessionDoc.data()
                allSessions.push({
                    id: sessionDoc.id,
                    userId,
                    date: data.date ?? null,
                    durationSeconds: data.durationSeconds ?? 0,
                    screen: data.screen ?? null,
                    startedAt: data.startedAt ?? null
                })
            }
        }

        // Ordenar por startedAt desc (en memoria)
        allSessions.sort((a, b) => {
            if (!a.startedAt) return 1
            if (!b.startedAt) return -1
            return String(b.startedAt).localeCompare(String(a.startedAt))
        })

        return reply.send({
            total: allSessions.length,
            data: allSessions
        })
    } catch (err: any) {
        req.log.error(err, 'Error consultando screen_time en Firestore')
        return reply.code(500).send({
            message: 'Error consultando datos de Firestore',
            error: err?.message || String(err)
        })
    }
}

