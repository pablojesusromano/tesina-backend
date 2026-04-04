import { getTrophiesByTriggerAction, hasUserUnlockedTrophy, unlockUserTrophy } from '../models/trophy.js'
import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'
import { findActionRewardByKey } from '../models/actionReward.js'
import { createActionHistory } from '../models/userActionHistory.js'
import { findNotificationTypeByKey } from '../models/notificationType.js'
import { createNotification } from '../models/notification.js'

export async function evaluateTrophies(userId: number, actionKey: string): Promise<void> {
    try {
        const candidateTrophies = await getTrophiesByTriggerAction(actionKey)
        if (candidateTrophies.length === 0) return

        for (const trophy of candidateTrophies) {
            const alreadyUnlocked = await hasUserUnlockedTrophy(userId, trophy.id)
            if (alreadyUnlocked) continue

            let meetsCondition = false

            // Conteo Fuerte (DB Status)
            if (actionKey === 'post_aprobado') {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT COUNT(p.id) as count FROM posts p 
                     INNER JOIN post_status ps ON p.status_id = ps.id 
                     WHERE p.user_id = ? AND ps.name = 'ACTIVO'`,
                    [userId]
                )
                const count = rows[0]?.count || 0
                if (count >= trophy.required_count) meetsCondition = true
            } else if (actionKey === 'comentar_post') {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT COUNT(id) as count FROM comments WHERE user_id = ?`,
                    [userId]
                )
                const count = rows[0]?.count || 0
                if (count >= trophy.required_count) meetsCondition = true
            } else if (actionKey === 'post_seleccionado') {
                meetsCondition = true
            }

            // Conteo Genérico en Acciones Pasadas
            if (!meetsCondition) {
                const [rewardRows] = await pool.query<RowDataPacket[]>(
                    `SELECT COUNT(uah.id) as count FROM user_action_history uah
                     INNER JOIN action_rewards ar ON ar.id = uah.action_reward_id
                     WHERE uah.user_id = ? AND ar.action_key = ?`,
                     [userId, actionKey]
                )
                const historyCount = rewardRows[0]?.count || 0
                if (historyCount >= trophy.required_count) {
                    meetsCondition = true
                }
            }

            if (meetsCondition) {
                await grantTrophyToUser(userId, trophy)
            }
        }
    } catch (err) {
        console.error(`[TrophyService] Error evaluando trofeos para ${actionKey} usuario ${userId}:`, err)
    }
}

async function grantTrophyToUser(userId: number, trophy: any): Promise<void> {
    const success = await unlockUserTrophy(userId, trophy.id)
    if (!success) return

    console.log(`[TrophyService] Usuario ${userId} ha desbloqueado trofeo ${trophy.key}`)

    const genericTrophyReward = await findActionRewardByKey('trofeo_desbloqueado')
    if (!genericTrophyReward) {
        console.error(`[TrophyService] NO EXISTE action_reward para 'trofeo_desbloqueado'.`)
        return
    }

    const historyId = await createActionHistory(
        userId,
        genericTrophyReward.id,
        trophy.exp_reward, // Se inyecta la XP dictada por el trofeo particular
        trophy.id, 
        undefined,
        false
    )

    if (historyId) {
        const notifType = await findNotificationTypeByKey('TROFEO_DESBLOQUEADO')
        if (notifType) {
            await createNotification(userId, notifType.id, {
                trophyName: trophy.name,
                expReward: trophy.exp_reward,
                historyId: historyId,
                trophyId: trophy.id // Enviamos trophyId para actualizar user_trophies.is_claimed
            })
        }
    }
}
