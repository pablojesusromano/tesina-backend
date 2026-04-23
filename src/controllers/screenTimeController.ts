import * as admin from 'firebase-admin';
import { FastifyRequest, FastifyReply } from 'fastify';

/** GET /admins/screen-time - Listar todos los registros de tiempo en pantalla desde Firestore */
export async function listScreenTime(req: FastifyRequest, reply: FastifyReply) {
    try {
        const db = admin.firestore();

        // **USAR CONSULTA DE GRUPO DE COLECCIONES**
        // Esto buscará todas las subcolecciones llamadas 'sessions' en tu base de datos
        const sessionsCollectionGroup = db.collectionGroup('sessions');
        const sessionsSnapshot = await sessionsCollectionGroup.get();

        const allSessions: any[] = [];

        sessionsSnapshot.forEach(sessionDoc => {
            const data = sessionDoc.data();
            // El ID del usuario (userId) será el ID del padre del documento 'sessions'
            // Puedes obtenerlo de la ruta del documento
            const userId = sessionDoc.ref.parent.parent?.id;

            if (userId) { // Asegúrate de que el userId exista
                allSessions.push({
                    id: sessionDoc.id,
                    userId,
                    date: data.date ?? null,
                    durationSeconds: data.durationSeconds ?? 0,
                    screen: data.screen ?? null,
                    startedAt: data.startedAt ?? null
                });
            }
        });

        // Ordenar por startedAt desc (en memoria)
        allSessions.sort((a, b) => {
            // Asegúrate de que startedAt sea comparable (por ejemplo, números o ISO strings)
            // Si son Timestamps de Firestore, conviértelos a milisegundos o Date objects.
            const startedAtA = a.startedAt instanceof admin.firestore.Timestamp ? a.startedAt.toMillis() : (a.startedAt ? new Date(a.startedAt).getTime() : 0);
            const startedAtB = b.startedAt instanceof admin.firestore.Timestamp ? b.startedAt.toMillis() : (b.startedAt ? new Date(b.startedAt).getTime() : 0);

            return startedAtB - startedAtA;
        });

        return reply.send({
            total: allSessions.length,
            data: allSessions
        });
    } catch (err: any) {
        req.log.error(err, 'Error consultando screen_time en Firestore');
        return reply.code(500).send({
            message: 'Error consultando datos de Firestore',
            error: err?.message || String(err)
        });
    }
}