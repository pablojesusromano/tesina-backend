import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'

const isProd = process.env.NODE_ENV === 'production'

const app = Fastify({
    logger: isProd
        ? true
        : {
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'SYS:standard',
                    colorize: true,
                    singleLine: true
                }
            }
        }
})

await app.register(cors)

app.get('/health', async () => ({ status: 'ok' }))

const port = Number(process.env.PORT ?? 3000)

try {
    await app.listen({ port, host: '127.0.0.1' })
    app.log.info(`Servidor escuchando en http://localhost:${port}`)
} catch (err) {
    app.log.error(err)
    process.exit(1)
}
