import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface Trophy {
    id: number
    key: string
    name: string
    description: string
    rarity: 'bronze' | 'silver' | 'gold' | 'platinum'
    trigger_action: string
    required_count: number
    exp_reward: number
    created_at: Date
}

export interface UserTrophy {
    id: number
    user_id: number
    trophy_id: number
    is_claimed: boolean
    unlocked_at: Date
}

export async function getAllTrophies(): Promise<Trophy[]> {
    const [rows] = await pool.query<(Trophy & RowDataPacket)[]>('SELECT * FROM trophies ORDER BY id ASC')
    return rows
}

export async function getTrophiesByTriggerAction(actionKey: string): Promise<Trophy[]> {
    const [rows] = await pool.query<(Trophy & RowDataPacket)[]>(
        'SELECT * FROM trophies WHERE trigger_action = ?',
        [actionKey]
    )
    return rows
}

export async function getUserTrophies(userId: number): Promise<UserTrophy[]> {
    const [rows] = await pool.query<(UserTrophy & RowDataPacket)[]>(
        'SELECT * FROM user_trophies WHERE user_id = ?',
        [userId]
    )
    return rows
}

export async function getUserTrophiesDetailed(userId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT t.*, 
            CASE WHEN ut.id IS NOT NULL THEN 1 ELSE 0 END as is_unlocked,
            ut.is_claimed, 
            ut.unlocked_at 
         FROM trophies t
         LEFT JOIN user_trophies ut ON ut.trophy_id = t.id AND ut.user_id = ?
         ORDER BY t.id ASC`,
        [userId]
    )
    return rows
}

export async function hasUserUnlockedTrophy(userId: number, trophyId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT 1 FROM user_trophies WHERE user_id = ? AND trophy_id = ? LIMIT 1',
        [userId, trophyId]
    )
    return rows.length > 0
}

export async function unlockUserTrophy(userId: number, trophyId: number): Promise<boolean> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO user_trophies (user_id, trophy_id, is_claimed) VALUES (?, ?, 0)',
            [userId, trophyId]
        )
        return result.affectedRows > 0
    } catch (e: any) {
        console.error('Error unlocking trophy', e)
        return false
    }
}

export async function markUserTrophyAsClaimed(userId: number, trophyId: number): Promise<boolean> {
    try {
        const [res] = await pool.query<ResultSetHeader>(
            'UPDATE user_trophies SET is_claimed = 1 WHERE user_id = ? AND trophy_id = ?',
            [userId, trophyId]
        )
        return res.affectedRows > 0
    } catch (e: any) {
        return false
    }
}
