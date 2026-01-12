import 'fastify'
import admin from 'firebase-admin'

declare module 'fastify' {
  interface FastifyInstance {
    firebase: typeof admin
  }
}
