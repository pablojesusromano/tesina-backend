import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface NotificationType {
    id: number
    key: string // Ej: 'primer_post_aprobado', 'torneo_pesca'
    title: string
    body: string // Puede contener {variables} a ser reemplazadas en vuelo
    created_at: Date
}

export async function findNotificationTypeByKey(key: string): Promise<NotificationType | null> {
    const [rows] = await pool.query<(NotificationType & RowDataPacket)[]>(
        'SELECT * FROM notification_types WHERE `key` = ?',
        [key]
    )
    return rows[0] || null
}

export async function getAllNotificationTypes(): Promise<NotificationType[]> {
    const [rows] = await pool.query<(NotificationType & RowDataPacket)[]>(
        'SELECT * FROM notification_types ORDER BY `key` ASC'
    )
    return rows
}
