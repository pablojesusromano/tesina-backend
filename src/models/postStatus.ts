import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'

export const POST_STATUS_NAMES = {
    BORRADOR:  'BORRADOR',
    ACTIVO:    'ACTIVO',
    RECHAZADO: 'RECHAZADO',
    ELIMINADO: 'ELIMINADO'
} as const

export type PostStatusName = typeof POST_STATUS_NAMES[keyof typeof POST_STATUS_NAMES]

export interface PostStatus {
    id:          number
    name:        PostStatusName
    description: string | null
}

let cache: PostStatus[] | null = null

async function load(): Promise<PostStatus[]> {
    if (cache) return cache
    const [rows] = await pool.query<(RowDataPacket & PostStatus)[]>(
        'SELECT id, name, description FROM post_status ORDER BY id'
    )
    cache = rows as PostStatus[]
    return cache
}

export async function getAllStatuses(): Promise<PostStatus[]> {
    return load()
}

export async function findStatusByName(name: string): Promise<PostStatus | null> {
    const list = await load()
    return list.find(s => s.name === name) ?? null
}

export async function findStatusById(id: number): Promise<PostStatus | null> {
    const list = await load()
    return list.find(s => s.id === id) ?? null
}

export async function resolveStatusIds(names: PostStatusName[]): Promise<number[]> {
    const list = await load()
    return names
        .map(n => list.find(s => s.name === n)?.id)
        .filter((id): id is number => id !== undefined)
}