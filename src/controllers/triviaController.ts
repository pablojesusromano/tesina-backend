import type { FastifyRequest, FastifyReply } from 'fastify'
import {
    getTodayQuestion,
    saveUserAnswer,
    getUserAnswerForQuestion,
    getUserCorrectCount,
    getTriviaRanking
} from '../models/trivia.js'
import { processAction } from '../services/gamificationService.js'
import { pool } from '../db/db.js'
import type { RowDataPacket } from 'mysql2'

/** GET /trivia/today - Pregunta del día */
export async function getTodayTrivia(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user

    try {
        const question = await getTodayQuestion()
        if (!question) {
            return reply.code(404).send({ message: 'No hay pregunta disponible para hoy' })
        }

        // Verificar si el usuario ya respondió
        const userAnswer = await getUserAnswerForQuestion(user.id, question.id)

        if (userAnswer) {
            // Ya respondió: mostrar pregunta + respuesta elegida + respuesta correcta
            const [allAnswers] = await pool.query<RowDataPacket[]>(
                `SELECT id, answer_text, is_correct FROM trivia_answers WHERE question_id = ?`,
                [question.id]
            )

            return reply.send({
                data: {
                    question_id: question.id,
                    question_text: question.question_text,
                    specie_name: question.specie_name,
                    answers: allAnswers,
                    already_answered: true,
                    user_answer_id: userAnswer.answer_id,
                    was_correct: Boolean(userAnswer.is_correct)
                }
            })
        }

        // No respondió todavía: mostrar pregunta sin revelar correcta
        return reply.send({
            data: {
                question_id: question.id,
                question_text: question.question_text,
                specie_name: question.specie_name,
                answers: question.answers, // sin is_correct
                already_answered: false
            }
        })
    } catch (err) {
        console.error('Error obteniendo trivia del día:', err)
        return reply.code(500).send({ message: 'Error interno' })
    }
}

/** POST /trivia/:questionId/answer - Responder pregunta */
export async function answerTrivia(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user
    const { questionId } = req.params as { questionId: string }
    const { answerId } = req.body as { answerId: number }
    const qId = Number(questionId)

    if (!answerId) {
        return reply.code(400).send({ message: 'answerId es requerido' })
    }

    try {
        // Verificar que la pregunta existe y es la de hoy
        const question = await getTodayQuestion()
        if (!question || question.id !== qId) {
            return reply.code(400).send({ message: 'Solo puedes responder la pregunta del día' })
        }

        // Verificar que la respuesta pertenece a esta pregunta
        const [answerRows] = await pool.query<RowDataPacket[]>(
            `SELECT id, is_correct FROM trivia_answers WHERE id = ? AND question_id = ?`,
            [answerId, qId]
        )
        if (answerRows.length === 0) {
            return reply.code(400).send({ message: 'Respuesta no válida para esta pregunta' })
        }

        // Guardar respuesta
        const saved = await saveUserAnswer(user.id, qId, answerId)
        if (!saved) {
            return reply.code(400).send({ message: 'Ya respondiste esta pregunta' })
        }

        const isCorrect = Boolean(answerRows[0]?.is_correct)

        // Si acertó, disparar gamificación
        if (isCorrect) {
            await processAction(user.id, 'trivia_correcta', { referenceId: qId })
        }

        // Devolver todas las respuestas con is_correct revelado
        const [allAnswers] = await pool.query<RowDataPacket[]>(
            `SELECT id, answer_text, is_correct FROM trivia_answers WHERE question_id = ?`,
            [qId]
        )

        return reply.send({
            data: {
                was_correct: isCorrect,
                correct_answer_id: allAnswers.find((a: any) => a.is_correct)?.id,
                answers: allAnswers
            }
        })
    } catch (err) {
        console.error('Error respondiendo trivia:', err)
        return reply.code(500).send({ message: 'Error interno' })
    }
}

/** GET /trivia/me/score - Contador de respuestas correctas del usuario */
export async function getMyTriviaScore(req: FastifyRequest, reply: FastifyReply) {
    const user = (req as any).user

    try {
        const correctCount = await getUserCorrectCount(user.id)
        return reply.send({ data: { correct_count: correctCount } })
    } catch (err) {
        console.error('Error obteniendo score trivia:', err)
        return reply.code(500).send({ message: 'Error interno' })
    }
}

/** GET /trivia/ranking - Ranking de trivia */
export async function getTriviaLeaderboard(req: FastifyRequest, reply: FastifyReply) {
    const limit = Math.min(50, Math.max(1, Number((req.query as any)?.limit ?? 20)))

    try {
        const ranking = await getTriviaRanking(limit)
        return reply.send({ data: ranking })
    } catch (err) {
        console.error('Error obteniendo ranking trivia:', err)
        return reply.code(500).send({ message: 'Error interno' })
    }
}
