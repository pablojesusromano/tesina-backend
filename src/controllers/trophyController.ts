import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAllTrophies, getUserTrophiesDetailed } from '../models/trophy.js'

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
