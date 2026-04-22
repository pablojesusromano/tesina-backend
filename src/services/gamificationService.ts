import { findActionRewardByKey } from '../models/actionReward.js'
import { hasActionHistory, createActionHistory, calculateUserTotalExp } from '../models/userActionHistory.js'
import { findUserById, updateUser } from '../models/user.js'
import { findNotificationTypeByKey } from '../models/notificationType.js'
import { createNotification } from '../models/notification.js'
import { evaluateTrophies } from './trophyService.js'

export async function processAction(
    userId: number,
    actionKey: string,
    options?: {
        referenceId?: number
        giverId?: number
    }
): Promise<boolean> {
    try {
        const user = await findUserById(userId)
        if (!user) {
            console.warn(`[Gamification] User not found: ${userId}`)
            return false
        }

        const { referenceId, giverId } = options || {}

        // ==================== APP NO-GAMIFICADA (type_app = 1) ====================
        // Solo registramos la acción sin recompensas, notificaciones ni trofeos
        if (user.type_app === 1) {
            await createActionHistory(
                userId,
                null,  // sin action_reward_id
                null,  // sin exp_earned
                referenceId,
                giverId,
                null   // sin is_claimed
            )
            console.log(`[Gamification] User ${userId} (non-gamified) action ${actionKey} logged without rewards.`)
            return true
        }

        // ==================== APP GAMIFICADA (type_app = 0) ====================
        const reward = await findActionRewardByKey(actionKey)
        if (!reward) {
            console.warn(`[Gamification] Action key not found: ${actionKey}`)
            return false
        }

        // Validaciones preventivas para exploits
        if (actionKey === 'registro_diario') {
            // Solo 1 vez al dia
            if (await hasActionHistory(userId, reward.id, undefined, undefined, true)) {
                return false
            }
        } else if (actionKey === 'comentar_post') {
            // Un usuario recibe exp 1 sola vez por post que comenta
            if (await hasActionHistory(userId, reward.id, referenceId)) {
                return false
            }
        } else if (actionKey === 'recibir_like') {
            // El autor recibe exp 1 sola vez por usuario que le da like a su post
            if (await hasActionHistory(userId, reward.id, referenceId, giverId)) {
                return false
            }
        } else if (actionKey === 'post_compartido' || actionKey === 'post_aprobado' || actionKey === 'publicar_post') {
            // 1 vez por post
            if (await hasActionHistory(userId, reward.id, referenceId)) {
                return false
            }
        } else if (actionKey === 'primer_post') {
            // Solo 1 vez en la vida
            if (await hasActionHistory(userId, reward.id)) {
                return false
            }
        }

        // Si pasó las validaciones, procedemos a otorgar la recompensa
        const insertedId = await createActionHistory(
            userId,
            reward.id,
            reward.exp_reward,
            referenceId,
            giverId,
            false // Puntos están pendientes de reclamo
        )

        if (!insertedId) return false

        // NO actualizamos users.exp o users.level aquí, ya que el reclamo es diferido.
        console.log(`[Gamification] User ${userId} action ${actionKey} logged. Pending claim for ${reward.exp_reward} EXP.`)

        // Buscar si existe un template de notificación asociado a esta acción y enviarlo
        try {
            const notifType = await findNotificationTypeByKey(actionKey)
            if (notifType && reward.exp_reward > 0) {
                await createNotification(userId, notifType.id, {
                    type: 'gamification_action',
                    prizeAmount: reward.exp_reward,
                    referenceId: referenceId || null,
                    historyId: insertedId // Ocultamos el historyId para liberarlo después
                })
            }
        } catch (err) {
            console.error(`[Gamification Error] Notification creation failed for ${actionKey}`, err)
        }

        // Evaluar posibles trofeos en background sin bloquear la respuesta principal
        evaluateTrophies(userId, actionKey).catch(err => {
            console.error(`[Gamification Error] Background trophy evaluation failed for ${actionKey}:`, err)
        })

        return true
    } catch (error) {
        console.error(`[Gamification Error] processing ${actionKey} for user ${userId}`, error)
        return false
    }
}

