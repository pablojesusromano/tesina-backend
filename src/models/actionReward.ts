import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'

export interface ActionReward {
    id: number
    action_key: string
    exp_reward: number
    action_type_id: number | null
    description: string | null
    created_at: Date
    updated_at: Date
}

export async function findActionRewardByKey(actionKey: string): Promise<ActionReward | null> {
    const [rows] = await pool.query<(ActionReward & RowDataPacket)[]>(
        'SELECT * FROM action_rewards WHERE action_key = ?',
        [actionKey]
    )
    return rows[0] || null
}
