import 'dotenv/config'
import mysql from 'mysql2/promise'

const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASS,
    DB_NAME,
    DB_CONN_LIMIT
} = process.env

if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASS || !DB_NAME || !DB_CONN_LIMIT) {
    throw new Error('Missing required database environment variables')
}

export const pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(DB_CONN_LIMIT),
    queueLimit: 0,
    // charset recomendado para emojis y acentos
    charset: 'utf8mb4_general_ci'
})

// utilitario para probar conexión
export async function pingDB() {
    const conn = await pool.getConnection()
    try {
        await conn.ping()
        const [rows] = await conn.query('SELECT 1 AS ok')
        return rows
    } finally {
        conn.release()
    }
}
