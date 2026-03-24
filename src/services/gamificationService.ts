import { findActionRewardByKey } from '../models/actionReward.js'
import { hasActionHistory, createActionHistory } from '../models/userActionHistory.js'
import { findUserById, updateUser } from '../models/user.js'

export async function processAction(
    userId: number,
    actionKey: string,
    options?: {
        referenceId?: number
        giverId?: number
    }
): Promise<boolean> {
    try {
        const reward = await findActionRewardByKey(actionKey)
        if (!reward) {
            console.warn(`[Gamification] Action key not found: ${actionKey}`)
            return false
        }

        const { referenceId, giverId } = options || {}

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
            reward.points_reward,
            referenceId,
            giverId
        )

        if (!insertedId) return false

        // Actualizar datos del usuario: EXP, Nivel y Puntos
        const user = await findUserById(userId)
        if (!user) return false

        const newExp = user.exp + reward.exp_reward
        const newPoints = user.points + reward.points_reward

        // La fórmula de nivel es: Nivel = Math.floor(exp / 100)
        const newLevel = Math.floor(newExp / 100)

        // Verificamos si los datos cambiaron para no hacer update innecesario
        if (newExp !== user.exp || newPoints !== user.points || newLevel !== user.level) {
            await updateUser(userId, {
                exp: newExp,
                points: newPoints,
                level: newLevel
            })

            console.log(`[Gamification] User ${userId} earned ${reward.exp_reward} EXP and ${reward.points_reward} Points for ${actionKey}. New Level: ${newLevel}`)
        }

        return true
    } catch (error) {
        console.error(`[Gamification Error] processing ${actionKey} for user ${userId}`, error)
        return false
    }
}
