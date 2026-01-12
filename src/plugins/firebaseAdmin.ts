import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import admin from 'firebase-admin'
import fs from 'fs'


async function firebaseAdmin(app: FastifyInstance) {
  if (admin.apps.length === 0) {
    const credentialsPath = process.env.FIREBASE_CREDENTIALS

    if (!credentialsPath) {
      throw new Error('FIREBASE_CREDENTIALS no está definido en el .env')
    }

    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`Archivo de credenciales no encontrado: ${credentialsPath}`)
    }

    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
  }

  app.decorate('firebase', admin)
}

export default fp(firebaseAdmin, {
  name: 'firebase-admin'
})