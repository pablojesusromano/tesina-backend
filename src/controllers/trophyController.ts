import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAllTrophies, getUserTrophiesDetailed, hasUserUnlockedTrophy, markUserTrophyAsClaimed } from '../models/trophy.js'
import { findActionRewardByKey } from '../models/actionReward.js'
import { createActionHistory, calculateUserTotalExp } from '../models/userActionHistory.js'
import { updateUser, findUserById } from '../models/user.js'

export async function listAllTrophies(req: FastifyRequest, reply: FastifyReply) {
    try {
        const trophies = await getAllTrophies()
        return reply.send({ data: trophies })
    } catch (err) {
        console.error('Error fetching trophies', err)
        return reply.code(500).send({ message: 'Error interno obteniendo trofeos' })
    }
}

export async function getMyTrophies(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    try {
        const myTrophies = await getUserTrophiesDetailed(user.id)
        return reply.send({ data: myTrophies })
    } catch (err) {
        console.error('Error fetching user trophies', err)
        return reply.code(500).send({ message: 'Error interno obteniendo mis trofeos' })
    }
}

/** PATCH /trophies/:id/claim - Reclamar recompensa de un trofeo */
export async function claimTrophy(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { id } = req.params as { id: string }
    const trophyId = Number(id)

    try {
        // 1. Verificar que el usuario tiene ese trofeo desbloqueado
        const unlocked = await hasUserUnlockedTrophy(user.id, trophyId)
        if (!unlocked) {
            return reply.code(404).send({ message: 'No has desbloqueado este trofeo' })
        }

        // 2. Verificar que no lo haya reclamado ya
        const myTrophies = await getUserTrophiesDetailed(user.id)
        const thisTrophy = myTrophies.find((t: any) => t.id === trophyId)
        if (!thisTrophy) {
            return reply.code(404).send({ message: 'Trofeo no encontrado' })
        }
        if (thisTrophy.is_claimed) {
            return reply.code(400).send({ message: 'Ya reclamaste este trofeo' })
        }

        // 3. Buscar la acción genérica de trofeo
        const trophyReward = await findActionRewardByKey('trofeo_desbloqueado')
        if (!trophyReward) {
            return reply.code(500).send({ message: 'Error de configuración: acción trofeo_desbloqueado no existe' })
        }

        // 4. Crear entrada en el historial con la EXP del trofeo, ya reclamada
        await createActionHistory(
            user.id,
            trophyReward.id,
            thisTrophy.exp_reward,
            undefined, // No necesita reference_id, user_trophies ya previene duplicados
            undefined,
            true // ya reclamada directamente
        )

        // 5. Marcar el trofeo como reclamado
        await markUserTrophyAsClaimed(user.id, trophyId)

        // 6. Recalcular EXP y nivel del usuario
        const newExp = await calculateUserTotalExp(user.id)
        const calculatedLevel = Math.floor(Math.sqrt(newExp / 100))
        const newLevel = calculatedLevel < 1 ? 1 : calculatedLevel
        await updateUser(user.id, { exp: newExp, level: newLevel })

        console.log(`[Trofeo Reclamo] Usuario ${user.id} reclamó trofeo ${trophyId} ("${thisTrophy.key}"). +${thisTrophy.exp_reward} EXP. Total: ${newExp}, Nivel: ${newLevel}`)

        const updatedUser = await findUserById(user.id)

        return reply.send({
            message: 'Trofeo reclamado exitosamente',
            trophy: {
                id: thisTrophy.id,
                key: thisTrophy.key,
                name: thisTrophy.name,
                exp_reward: thisTrophy.exp_reward
            },
            user: {
                exp: updatedUser?.exp || 0,
                level: updatedUser?.level || 1
            }
        })
    } catch (err) {
        console.error('Error reclamando trofeo:', err)
        return reply.code(500).send({ message: 'Error interno reclamando trofeo' })
    }
}
