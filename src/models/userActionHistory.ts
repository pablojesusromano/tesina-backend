import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface UserActionHistory {
    id: number
    user_id: number
    action_reward_id: number
    reference_id: number | null
    giver_id: number | null
    exp_earned: number
    is_claimed: boolean
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
    actionRewardId: number,
    expEarned: number,
    referenceId?: number,
    giverId?: number,
    isClaimed: boolean = false
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO user_action_history 
            (user_id, action_reward_id, exp_earned, reference_id, giver_id, is_claimed) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, actionRewardId, expEarned, referenceId ?? null, giverId ?? null, isClaimed]
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
         INNER JOIN action_rewards ar ON ar.id = uah.action_reward_id
         WHERE uah.user_id = ?
         ORDER BY uah.created_at DESC`,
        [userId]
    )
    return rows
}
