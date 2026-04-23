import type { FastifyRequest, FastifyReply } from 'fastify'
import admin from 'firebase-admin'

/** GET /admins/screen-time - Listar todos los registros de tiempo en pantalla desde Firestore */
export async function listScreenTime(req: FastifyRequest, reply: FastifyReply) {
    try {
        const db = admin.firestore()
        const screenTimeRef = db.collection('screen_time')

        // Obtener todos los documentos de usuarios dentro de screen_time
        const usersSnapshot = await screenTimeRef.get()

        const allSessions: any[] = []

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id
            const sessionsSnapshot = await screenTimeRef
                .doc(userId)
                .collection('sessions')
                .orderBy('startedAt', 'desc')
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

        return reply.send({
            total: allSessions.length,
            data: allSessions
        })
    } catch (err: any) {
        req.log.error(err, 'Error consultando screen_time en Firestore')
        return reply.code(500).send({ message: 'Error consultando datos de Firestore' })
    }
}
