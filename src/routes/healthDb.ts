import type { FastifyInstance } from 'fastify'
import { pool } from '../db/db'

export default async function healthDb(app: FastifyInstance) {
    app.get('/db-health', async () => {
        const [rows] = await pool.query('SELECT NOW() as now')
        // @ts-ignore: mysql2 types: rows es RowDataPacket[]
        return rows[0]
    })
}
