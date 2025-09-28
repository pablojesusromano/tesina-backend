import type { FastifyInstance } from 'fastify'
import admin from 'firebase-admin'

export default async function firebaseAdmin(app: FastifyInstance) {
    if (admin.apps.length === 0) {
        // Opción A: variable GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de servicio
        // Opción B: credenciales desde env (FIREBASE_SERVICE_ACCOUNT como JSON string)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            admin.initializeApp({
                credential: admin.credential.cert(svc)
            })
        } else {
            admin.initializeApp() // usará GOOGLE_APPLICATION_CREDENTIALS si está seteada
        }
    }

    app.decorate('firebase', admin)
}

declare module 'fastify' {
    interface FastifyInstance {
        firebase: typeof admin
    }
}
