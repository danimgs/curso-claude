import { Router } from 'express'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { TableService } from '@services/table.service.js'
import { TableController } from '@controllers/table.controller.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const tableRepository = new SqliteTableRepository(dbConfig)
const tableService = new TableService(tableRepository)
const tableController = new TableController(tableService)

const STAFF_ROLES = ['admin', 'manager', 'camarero']

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorizeRestaurant, authorize(['admin']), tableController.create)
router.get('/', authenticate, authorizeRestaurant, authorize(STAFF_ROLES), tableController.getAll)
router.get('/:id', authenticate, authorizeRestaurant, authorize(STAFF_ROLES), tableController.getById)
router.put('/:id', authenticate, authorizeRestaurant, authorize(['admin']), tableController.update)
router.delete('/:id', authenticate, authorizeRestaurant, authorize(['admin']), tableController.delete)
router.patch('/:id/status', authenticate, authorizeRestaurant, authorize(STAFF_ROLES), tableController.updateStatus)
// Sin authorizeRestaurant: el cliente no tiene restaurante; la pertenencia de la mesa la comprueba el servicio
router.post('/:id/occupy', authenticate, authorize(['cliente']), tableController.occupy)

export default router
