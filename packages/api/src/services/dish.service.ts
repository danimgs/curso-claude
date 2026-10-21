import { randomUUID } from 'crypto'
import type { Dish, DishIngredient } from '@models/dish.model.js'
import { normalizeDishCategory, validateDishIngredient } from '@models/dish.model.js'
import type { DishRepository } from '@repositories/dish.repository.js'
import type { IngredientRepository } from '@repositories/ingredient.repository.js'
import { DishNameRequiredError, InvalidPriceError, RestaurantIdRequiredError, DishNotFoundError, NameTooLongError, InvalidDishIngredientError, IngredientNotFoundError } from '@errors/DomainErrors.js'

interface CreateDishInput {
    name: string
    description: string | null
    price: number
    category: string
    available: boolean
    restaurantId: string
    ingredients: DishIngredient[]
}

interface UpdateDishInput {
    name: string
    description: string | null
    price: number
    category: string
    available: boolean
    ingredients: DishIngredient[]
}

const MAX_NAME_LENGTH = 100

export class DishService {
    constructor(
        private readonly dishRepository: DishRepository,
        private readonly ingredientRepository: IngredientRepository
    ) {}

    async create(input: CreateDishInput): Promise<Dish> {
        const now = new Date().toISOString()
        const dish = this.buildDish({
            id: randomUUID(),
            name: input.name,
            description: input.description,
            price: input.price,
            category: input.category,
            available: input.available ?? true,
            restaurantId: input.restaurantId,
            ingredients: input.ingredients ?? [],
            createdAt: now,
            updatedAt: now
        })

        await this.assertIngredientsBelongToRestaurant(dish.ingredients, dish.restaurantId)
        await this.dishRepository.save(dish)
        return dish
    }

    async update(id: string, input: UpdateDishInput, restaurantId?: string): Promise<Dish> {
        const existing = await this.dishRepository.findById(id)
        if (!existing || (restaurantId !== undefined && existing.restaurantId !== restaurantId)) {
            throw new DishNotFoundError()
        }

        const now = new Date().toISOString()
        const updated = this.buildDish({
            id: existing.id,
            name: input.name,
            description: input.description,
            price: input.price,
            category: input.category,
            available: input.available,
            restaurantId: existing.restaurantId,
            ingredients: input.ingredients ?? [],
            createdAt: existing.createdAt,
            updatedAt: now
        })

        await this.assertIngredientsBelongToRestaurant(updated.ingredients, updated.restaurantId)
        await this.dishRepository.save(updated)
        return updated
    }

    async delete(id: string, restaurantId?: string): Promise<void> {
        const dish = await this.dishRepository.findById(id)
        if (!dish || (restaurantId !== undefined && dish.restaurantId !== restaurantId)) {
            throw new DishNotFoundError()
        }
        await this.dishRepository.delete(id)
    }

    async findById(id: string, restaurantId?: string): Promise<Dish | null> {
        const found = await this.dishRepository.findById(id)
        if (found && restaurantId !== undefined && found.restaurantId !== restaurantId) {
            return null
        }
        return found
    }

    async findByRestaurantId(restaurantId: string): Promise<Dish[]> {
        return this.dishRepository.findByRestaurantId(restaurantId)
    }

    // Un ingrediente de otro restaurante se trata como inexistente para no confirmar que existe
    private async assertIngredientsBelongToRestaurant(ingredients: DishIngredient[], restaurantId: string): Promise<void> {
        for (const { ingredientId } of ingredients) {
            const ingredient = await this.ingredientRepository.findById(ingredientId)
            if (!ingredient || ingredient.restaurantId !== restaurantId) {
                throw new IngredientNotFoundError()
            }
        }
    }

    private buildDish(props: {
        id: string
        name: string
        description: string | null
        price: number
        category: string
        available: boolean
        restaurantId: string
        ingredients: DishIngredient[]
        createdAt: string
        updatedAt: string
    }): Dish {
        if (typeof props.name !== 'string' || props.name.trim() === '') {
            throw new DishNameRequiredError()
        }
        if (props.name.length > MAX_NAME_LENGTH) {
            throw new NameTooLongError(MAX_NAME_LENGTH)
        }
        if (typeof props.price !== 'number' || !Number.isFinite(props.price) || props.price <= 0) {
            throw new InvalidPriceError()
        }
        if (!Array.isArray(props.ingredients)) {
            throw new InvalidDishIngredientError('ingredients must be a list')
        }
        if (!props.restaurantId || props.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        return {
            id: props.id,
            name: props.name,
            description: props.description ?? null,
            price: props.price,
            category: normalizeDishCategory(props.category),
            available: props.available,
            restaurantId: props.restaurantId,
            ingredients: props.ingredients.map(i => validateDishIngredient(i)),
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }
}
