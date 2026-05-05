import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface AppNotification {
    id: number
    notification_type_id: number
    type: 'INDIVIDUAL' | 'GLOBAL'
    user_id: number | null
    data: any // JSON metadata
    is_claimed: boolean
    read_at: Date | null
    created_at: Date
    // Estos campos vendrán del JOIN con notification_types:
    n_key?: string
    title?: string
    body?: string
}

export async function createNotification(
    userId: number,
    notificationTypeId: number,
    dataJson: any
): Promise<number | null> {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO notifications (user_id, notification_type_id, type, data, is_claimed)
         VALUES (?, ?, 'INDIVIDUAL', ?, false)`,
        [userId, notificationTypeId, JSON.stringify(dataJson || {})]
    )
    return result.insertId || null
}

export async function createBroadcastFanout(
    notificationTypeId: number,
    dataJson: any,
    gamifiedOnly: boolean = false
): Promise<number> {
    // Inserta 1 copia INDIVIDUAL para cada usuario registrado (Fanout)
    // El frontend lo tratará como una notificación individual
    const whereClause = gamifiedOnly
        ? 'WHERE type_app = 0 AND deleted_at IS NULL'
        : 'WHERE deleted_at IS NULL'

    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO notifications (user_id, notification_type_id, type, data, is_claimed)
         SELECT id, ?, 'GLOBAL', ?, false FROM users ${whereClause}`,
        [notificationTypeId, JSON.stringify(dataJson || {})]
    )
    return result.affectedRows
}

export async function getUserNotifications(userId: number): Promise<AppNotification[]> {
    // Notificaciones no reclamadas, EXCLUYENDO las no-premio leídas hace más de 24h.
    // Las notificaciones de premio (gamification_action) permanecen hasta ser reclamadas.
    const [rows] = await pool.query<(AppNotification & RowDataPacket)[]>(
        `SELECT n.*, t.key as n_key, t.title, t.body 
         FROM notifications n
         INNER JOIN notification_types t ON t.id = n.notification_type_id
         WHERE n.user_id = ? AND n.is_claimed = 0
           AND NOT (
             n.read_at IS NOT NULL
             AND n.read_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
             AND (n.data NOT LIKE '%"type":"gamification_action"%' OR n.data IS NULL)
           )
         ORDER BY n.id DESC`,
        [userId]
    )
    return rows
}

export async function getNotificationById(id: number): Promise<AppNotification | null> {
    const [rows] = await pool.query<(AppNotification & RowDataPacket)[]>(
        `SELECT n.*, t.key as n_key, t.title, t.body 
         FROM notifications n
         INNER JOIN notification_types t ON t.id = n.notification_type_id
         WHERE n.id = ?`,
        [id]
    )
    return rows[0] || null
}

export async function markNotificationAsRead(id: number, userId: number): Promise<boolean> {
    // Solo setear read_at la primera vez que se marca como leída
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?',
        [id, userId]
    )
    return result.affectedRows > 0
}

export async function markNotificationAsClaimed(id: number, userId: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE notifications SET is_claimed = true WHERE id = ? AND user_id = ?',
        [id, userId]
    )
    return result.affectedRows > 0
}

export async function getUserNotificationHistory(userId: number): Promise<AppNotification[]> {
    const [rows] = await pool.query<(AppNotification & RowDataPacket)[]>(
        `SELECT n.*, t.key as n_key, t.title, t.body 
         FROM notifications n
         INNER JOIN notification_types t ON t.id = n.notification_type_id
         WHERE n.user_id = ?
         ORDER BY n.id DESC`,
        [userId]
    )
    return rows
}
