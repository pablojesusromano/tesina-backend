import type { FastifyInstance } from 'fastify'
import { registerDevice, listUserDevices, modifyDeviceToken, getMyDevices } from '../controllers/deviceController.js'
import { protectUserOrAdminRoute } from '../middlewares/authMiddleware.js'

export default async function deviceRoutes(app: FastifyInstance) {
    app.addHook('preHandler', protectUserOrAdminRoute)

    app.post('/', registerDevice)
    app.get('/user/:id', listUserDevices)
    app.get('/me', getMyDevices)
    app.patch('/:id', modifyDeviceToken)
}
