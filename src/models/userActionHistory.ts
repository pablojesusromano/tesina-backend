import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface UserActionHistory {
    id: number
    user_id: number
    action_reward_id: number
    reference_id: number | null
    giver_id: number | null
    exp_earned: number
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
    giverId?: number
): Promise<number | null> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO user_action_history 
            (user_id, action_reward_id, exp_earned, reference_id, giver_id) 
            VALUES (?, ?, ?, ?, ?)`,
            [userId, actionRewardId, expEarned, referenceId ?? null, giverId ?? null]
        )
        return result.insertId
    } catch (e: any) {
        console.error('Error inserting action history', e)
        return null
    }
}
