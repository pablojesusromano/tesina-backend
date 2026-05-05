import { pool } from '../db/db.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface TriviaQuestion {
    id: number
    question_text: string
    specie_id: number | null
    scheduled_date: string
}

export interface TriviaAnswer {
    id: number
    question_id: number
    answer_text: string
    is_correct: boolean
}

/** Obtener la pregunta del día con sus 4 respuestas.
 *  Usa rotación cíclica: si no hay pregunta para hoy por fecha exacta,
 *  elige la pregunta cuyo índice = (dayOfYear % totalQuestions).
 */
export async function getTodayQuestion(): Promise<any | null> {
    // Intentar primero por fecha exacta (para días futuros planificados)
    const [byDate] = await pool.query<RowDataPacket[]>(
        `SELECT tq.*, s.name as specie_name
         FROM trivia_questions tq
         LEFT JOIN species s ON s.id = tq.specie_id
         WHERE tq.scheduled_date = CURDATE()
         LIMIT 1`
    )

    let question = byDate[0] ?? null

    // Si no hay por fecha, rotar cíclicamente por día del año
    if (!question) {
        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM trivia_questions`
        )
        const total = Number(countRows[0]?.total) || 0
        if (total === 0) return null

        // dayOfYear va de 1 a 365/366; lo convertimos a índice 0-based
        const [dayRows] = await pool.query<RowDataPacket[]>(
            `SELECT DAYOFYEAR(CURDATE()) - 1 as day_index`
        )
        const dayIndex = Number(dayRows[0]?.day_index) || 0
        const offset = dayIndex % total

        const [cyclic] = await pool.query<RowDataPacket[]>(
            `SELECT tq.*, s.name as specie_name
             FROM trivia_questions tq
             LEFT JOIN species s ON s.id = tq.specie_id
             ORDER BY tq.id ASC
             LIMIT 1 OFFSET ?`,
            [offset]
        )
        question = cyclic[0] ?? null
    }

    if (!question) return null

    const [answers] = await pool.query<RowDataPacket[]>(
        `SELECT id, question_id, answer_text FROM trivia_answers WHERE question_id = ?`,
        [question.id]
    )

    return { ...question, answers }
}

/** Registrar la respuesta del usuario */
export async function saveUserAnswer(userId: number, questionId: number, answerId: number): Promise<boolean> {
    try {
        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO user_trivia_answers (user_id, question_id, answer_id) VALUES (?, ?, ?)`,
            [userId, questionId, answerId]
        )
        return result.affectedRows > 0
    } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') return false // Ya respondió esta pregunta
        throw e
    }
}

/** Verificar si el usuario ya respondió esta pregunta */
export async function getUserAnswerForQuestion(userId: number, questionId: number): Promise<any | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT uta.*, ta.is_correct, ta.answer_text as chosen_answer
         FROM user_trivia_answers uta
         INNER JOIN trivia_answers ta ON ta.id = uta.answer_id
         WHERE uta.user_id = ? AND uta.question_id = ?`,
        [userId, questionId]
    )
    return rows[0] || null
}

/** Contar respuestas correctas del usuario */
export async function getUserCorrectCount(userId: number): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as correct_count
         FROM user_trivia_answers uta
         INNER JOIN trivia_answers ta ON ta.id = uta.answer_id
         WHERE uta.user_id = ? AND ta.is_correct = 1`,
        [userId]
    )
    return Number(rows[0]?.correct_count) || 0
}

/** Ranking de usuarios por respuestas correctas */
export async function getTriviaRanking(limit: number = 20): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
            u.id as user_id, 
            u.username, 
            u.name, 
            u.image,
            COUNT(*) as correct_count
         FROM user_trivia_answers uta
         INNER JOIN trivia_answers ta ON ta.id = uta.answer_id
         INNER JOIN users u ON u.id = uta.user_id
         WHERE ta.is_correct = 1 AND u.type_app = 0 AND u.deleted_at IS NULL
         GROUP BY u.id, u.username, u.name, u.image
         ORDER BY correct_count DESC
         LIMIT ?`,
        [limit]
    )
    return rows
}
