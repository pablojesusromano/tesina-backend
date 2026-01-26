import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import { MAX_FILE_SIZE, MAX_FILES } from '../config/upload.js'

async function multipartPlugin(app: FastifyInstance) {
    await app.register(multipart, {
        limits: {
            fileSize: MAX_FILE_SIZE,
            files: MAX_FILES
        }
    })
}

export default fp(multipartPlugin, {
    name: 'multipart'
})