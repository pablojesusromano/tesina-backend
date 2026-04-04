import type { FastifyInstance } from 'fastify'
import { getTodayTrivia, answerTrivia, getMyTriviaScore, getTriviaLeaderboard } from '../controllers/triviaController.js'
import { protectUserRoute } from '../middlewares/userAuthMiddleware.js'

export default async function triviaRoutes(app: FastifyInstance) {
    app.addHook('preHandler', protectUserRoute)

    // GET /trivia/today - Pregunta del día
    app.get('/today', getTodayTrivia)

    // POST /trivia/:questionId/answer - Responder pregunta
    app.post('/:questionId/answer', answerTrivia)

    // GET /trivia/me/score - Mi contador de respuestas correctas
    app.get('/me/score', getMyTriviaScore)

    // GET /trivia/ranking - Ranking de trivia
    app.get('/ranking', getTriviaLeaderboard)
}
