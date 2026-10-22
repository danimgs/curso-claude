import { Router } from 'express'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { TableService } from '@services/table.service.js'
import { TableController } from '@controllers/table.controller.js'

const tableService = new TableService(new SqliteTableRepository(dbConfig))
const tableController = new TableController(tableService)

const router = Router({ mergeParams: true })

router.get('/', tableController.getAvailable)

export default router
