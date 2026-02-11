import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { protectAdminRoute } from '../middlewares/authMiddleware.js'
import { sendSightingNotification } from '../services/firebaseCloudMessagingService.js'
import { findPostById } from '../models/post.js'

export default async function notificationRoutes(app: FastifyInstance) {
    app.addHook('preHandler', protectAdminRoute)

    // POST /notifications/test - Enviar notificación de prueba
    app.post('/test', async (req: FastifyRequest, reply: FastifyReply) => {
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
                message: 'Notificación de prueba enviada',
                postId 
            })
        } catch (error) {
            app.log.error({ msg: 'Error enviando notificación de prueba', error })
            return reply.code(500).send({ message: 'Error enviando notificación' })
        }
    })

    // POST /notifications/test-simple - Notificación simple
    app.post('/test-simple', async (req: FastifyRequest, reply: FastifyReply) => {
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