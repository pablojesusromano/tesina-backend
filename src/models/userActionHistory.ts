import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface UserActionHistory {
    id: number
    user_id: number
    action_reward_id: number | null
    reference_id: number | null
    giver_id: number | null
    exp_earned: number | null
    is_claimed: boolean | null
    created_at: Date
}

export async function hasActionHistory(
    userId: number,
    actionRewardId: number,
    referenceId?: number,
    giverId?: number,
    isDailyCheck?: boolean
): Promise<boolean> {
    let query = 'SELECT 1 FROM user_action_history WHERE user_id = ? AND action_reward_id = ?'
    const values: any[] = [userId, actionRewardId]

    if (referenceId !== undefined) {
        query += ' AND reference_id = ?'
        values.push(referenceId)
    }

    if (giverId !== undefined) {
        query += ' AND giver_id = ?'
        values.push(giverId)
    }

    if (isDailyCheck) {
        query += ' AND DATE(created_at) = CURDATE()'
    }

    query += ' LIMIT 1'

    const [rows] = await pool.query<RowDataPacket[]>(query, values)
    return rows.length > 0
}

export async function createActionHistory(
    userId: number,
    actionRewardId: number | null,
    expEarned: number | null,
    referenceId?: number,
    giverId?: number,
    isClaimed: boolean | null = false
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO user_action_history 
            (user_id, action_reward_id, exp_earned, reference_id, giver_id, is_claimed) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, actionRewardId ?? null, expEarned ?? null, referenceId ?? null, giverId ?? null, isClaimed ?? null]
        )
        return result.insertId
    } catch (e: any) {
        console.error('Error inserting action history', e)
        return null
    }
}

export async function calculateUserTotalExp(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT SUM(exp_earned) as totalExp FROM user_action_history WHERE user_id = ? AND is_claimed = 1',
        [userId]
    )
    return Number(rows[0]?.totalExp) || 0
}

export async function markActionHistoryAsClaimed(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
        'UPDATE user_action_history SET is_claimed = 1 WHERE id = ?',
        [id]
    )
    return result.affectedRows > 0
}

export async function getUserTimeline(userId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
            uah.id,
            uah.exp_earned,
            uah.reference_id,
            uah.is_claimed,
            uah.created_at,
            ar.action_key,
            ar.description as action_description
         FROM user_action_history uah
         LEFT JOIN action_rewards ar ON ar.id = uah.action_reward_id
         WHERE uah.user_id = ?
         ORDER BY uah.created_at DESC`,
        [userId]
    )
    return rows
}

export async function getUserStreak(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `WITH login_dates AS (
            SELECT DISTINCT DATE(uah.created_at) as login_date
            FROM user_action_history uah
            INNER JOIN action_rewards ar ON ar.id = uah.action_reward_id
            WHERE uah.user_id = ? AND ar.action_key = 'registro_diario'
        ),
        grouped AS (
            SELECT login_date,
                DATE_SUB(login_date, INTERVAL ROW_NUMBER() OVER (ORDER BY login_date) DAY) as grp
            FROM login_dates
        ),
        streaks AS (
            SELECT grp, COUNT(*) as streak_length, MAX(login_date) as last_date
            FROM grouped
            GROUP BY grp
        )
        SELECT COALESCE(MAX(streak_length), 0) as current_streak
        FROM streaks
        WHERE last_date >= CURDATE() - INTERVAL 1 DAY`,
        [userId]
    )
    return Number(rows[0]?.current_streak) || 0
}

export async function getStreakRanking(limit: number = 20): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `WITH login_dates AS (
            SELECT DISTINCT uah.user_id, DATE(uah.created_at) as login_date
            FROM user_action_history uah
            INNER JOIN action_rewards ar ON ar.id = uah.action_reward_id
            WHERE ar.action_key = 'registro_diario'
        ),
        grouped AS (
            SELECT user_id, login_date,
                DATE_SUB(login_date, INTERVAL ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) DAY) as grp
            FROM login_dates
        ),
        streaks AS (
            SELECT user_id, grp, COUNT(*) as streak_length, MAX(login_date) as last_date
            FROM grouped
            GROUP BY user_id, grp
        ),
        current_streaks AS (
            SELECT user_id, MAX(streak_length) as streak
            FROM streaks
            WHERE last_date >= CURDATE() - INTERVAL 1 DAY
            GROUP BY user_id
        )
        SELECT cs.user_id, cs.streak, u.username, u.name, u.image
        FROM current_streaks cs
        INNER JOIN users u ON u.id = cs.user_id
        WHERE u.type_app = 0 AND u.deleted_at IS NULL
        ORDER BY cs.streak DESC
        LIMIT ?`,
        [limit]
    )
    return rows
}
