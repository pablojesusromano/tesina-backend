import type { FastifyRequest, FastifyReply } from 'fastify'
import admin from 'firebase-admin'

/** GET /admins/screen-time - Listar todos los registros de tiempo en pantalla desde Firestore */
export async function listScreenTime(req: FastifyRequest, reply: FastifyReply) {
    try {
        const db = admin.firestore()

        // collectionGroup busca en TODAS las subcolecciones llamadas 'sessions'
        // sin necesidad de que el documento padre exista explícitamente
        const sessionsSnapshot = await db
            .collectionGroup('sessions')
            .orderBy('startedAt', 'desc')
            .get()

        const allSessions = sessionsSnapshot.docs.map(doc => {
            const data = doc.data()
            // Extraer el userId del path: screen_time/{userId}/sessions/{sessionId}
            const pathSegments = doc.ref.path.split('/')
            const userId = pathSegments[1] // screen_time / {userId} / sessions / {sessionId}

            return {
                id: doc.id,
                userId,
                date: data.date ?? null,
                durationSeconds: data.durationSeconds ?? 0,
                screen: data.screen ?? null,
                startedAt: data.startedAt ?? null
            }
        })

        return reply.send({
            total: allSessions.length,
            data: allSessions
        })
    } catch (err: any) {
        req.log.error(err, 'Error consultando screen_time en Firestore')
        return reply.code(500).send({ message: 'Error consultando datos de Firestore' })
    }
}
