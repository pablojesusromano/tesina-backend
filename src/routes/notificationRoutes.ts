import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { protectAdminRoute, protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'
import {
    getMyNotifications,
    readNotification,
    claimNotification,
    broadcastNotification
} from '../controllers/notificationController.js'
import { sendSightingNotification } from '../services/firebaseCloudMessagingService.js'
import { findPostById } from '../models/post.js'

export default async function notificationRoutes(app: FastifyInstance) {

    // ==== RUTAS PARA USUARIO FINAL ====
    // Se protege con protectUserOrAdminRoute para que acepte Bearer tokens de users móviles
    app.get('/me', { preHandler: [protectUserOrAdminRoute] }, getMyNotifications)
    app.patch('/:id/read', { preHandler: [protectUserOrAdminRoute] }, readNotification)
    app.patch('/:id/claim', { preHandler: [protectUserOrAdminRoute] }, claimNotification)


    // ==== RUTAS PARA ADMIN (Gestión interna/Broadcast/Pruebas FCM) ====
    app.post('/broadcast', { preHandler: [protectAdminRoute] }, broadcastNotification)

    // POST /notifications/test - Enviar notificación de prueba
    app.post('/test', { preHandler: [protectAdminRoute] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const { postId } = req.body as { postId: number }

        if (!postId) {
            return reply.code(400).send({ message: 'postId es requerido' })
        }

        try {
            const post = await findPostById(postId)

            if (!post) {
                return reply.code(404).send({ message: 'Post no encontrado' })
            }

            await sendSightingNotification(app, {
                postId: post.id,
                userName: post.user_name || 'Usuario',
                latitude: post.images?.[0]?.latitude ?? null,
                longitude: post.images?.[0]?.longitude ?? null
            })

            return reply.send({
                message: 'Notificación de FCM (Firebase) enviada para ese post',
                postId
            })
        } catch (error) {
            app.log.error({ msg: 'Error enviando notificación de prueba', error })
            return reply.code(500).send({ message: 'Error enviando notificación FCM' })
        }
    })

    // POST /notifications/test-simple - Notificación simple
    app.post('/test-simple', { preHandler: [protectAdminRoute] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const message = {
                topic: 'sightings',
                notification: {
                    title: '🐋 Prueba de notificación',
                    body: 'Esta es una notificación de prueba'
                },
                data: {
                    type: 'test'
                }
            }

            const response = await app.firebase.messaging().send(message)

            return reply.send({
                message: 'Notificación enviada',
                messageId: response
            })
        } catch (error) {
            app.log.error({ msg: 'Error', error })
            return reply.code(500).send({ message: 'Error enviando notificación' })
        }
    })
}