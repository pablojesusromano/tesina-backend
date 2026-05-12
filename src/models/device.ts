import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface Device {
    id: number
    user_id: number
    token: string
    type: string
    created_at: Date
    updated_at: Date | null
}

export async function createDevice(userId: number, token: string, type: string = 'ANDROID'): Promise<number | null> {
    const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO devices (user_id, token, type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), type = VALUES(type)',
        [userId, token, type]
    )
    return result.insertId || null
}

export async function getDevicesByUserId(userId: number): Promise<Device[]> {
    const [rows] = await pool.execute<(Device & RowDataPacket)[]>(
        'SELECT * FROM devices WHERE user_id = ?',
        [userId]
    )
    return rows
}

export async function updateDeviceToken(deviceId: number, userId: number, newToken: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE devices SET token = ? WHERE id = ? AND user_id = ?',
        [newToken, deviceId, userId]
    )
    return result.affectedRows > 0
}

export async function getTokensByTarget(
    target: 'all' | 'gamified' | 'non_gamified'
): Promise<string[]> {
    const whereClause =
        target === 'gamified'     ? 'AND u.type_app = 0' :
        target === 'non_gamified' ? 'AND u.type_app = 1' :
                                    ''

    const [rows] = await pool.execute<(RowDataPacket & { token: string })[]>(
        `SELECT d.token
         FROM devices d
         INNER JOIN users u ON u.id = d.user_id
         WHERE u.deleted_at IS NULL
           AND d.token IS NOT NULL
           AND d.token != ''
           ${whereClause}`
    )
    return rows.map(r => r.token)
}

export async function deleteDevice(deviceId: number, userId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM devices WHERE id = ? AND user_id = ?',
        [deviceId, userId]
    )
    return result.affectedRows > 0
}
