import { Router } from 'express'
import { IngredientController } from '@controllers/ingredient.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteIngredientRepository } from '@repositories/ingredient.repository.js'
import { IngredientService } from '@services/ingredient.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const ingredientRepository = new SqliteIngredientRepository(dbConfig)
const ingredientService = new IngredientService(ingredientRepository)
const ingredientController = new IngredientController(ingredientService)

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorizeRestaurant, authorize(['admin']), ingredientController.create)
router.get('/', authenticate, authorizeRestaurant, authorize(['admin', 'manager', 'cocinero']), ingredientController.getAll)
router.get('/:id', authenticate, authorizeRestaurant, authorize(['admin', 'manager', 'cocinero']), ingredientController.getById)
router.put('/:id', authenticate, authorizeRestaurant, authorize(['admin']), ingredientController.update)
router.delete('/:id', authenticate, authorizeRestaurant, authorize(['admin']), ingredientController.delete)

export default router
