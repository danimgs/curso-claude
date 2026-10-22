import { describe, it, expect, beforeEach } from 'vitest'
import { DishService } from './dish.service.js'
import { MockDishRepository } from '@repositories/mocks/MockDishRepository.js'
import { MockIngredientRepository } from '@repositories/mocks/MockIngredientRepository.js'
import type { Ingredient } from '@models/ingredient.model.js'
import {
    InvalidPriceError, DishNameRequiredError, NameTooLongError,
    InvalidDishIngredientError, IngredientNotFoundError
} from '@errors/DomainErrors.js'

const ingredient = (id: string, restaurantId: string): Ingredient => ({
    id, name: id, unit: 'kg', currentStock: 1, restaurantId, createdAt: '', updatedAt: ''
})

describe('DishService: validación de entrada', () => {
    let service: DishService

    const input = (overrides: Record<string, unknown> = {}) => ({
        name: 'Pizza', description: null, price: 9.5, category: 'principal', available: true,
        restaurantId: 'r1', ingredients: [{ ingredientId: 'i1', quantity: 2 }], ...overrides
    }) as any

    beforeEach(async () => {
        const ingredients = new MockIngredientRepository()
        await ingredients.save(ingredient('i1', 'r1'))
        await ingredients.save(ingredient('i-otro', 'r2'))
        service = new DishService(new MockDishRepository(), ingredients)
    })

    it('crea un plato válido', async () => {
        const dish = await service.create(input())
        expect(dish.price).toBe(9.5)
    })

    it.each([NaN, Infinity, -Infinity, 0, -1, '5', 'abc', null, undefined])('rechaza price %s', async (price) => {
        await expect(service.create(input({ price }))).rejects.toThrow(InvalidPriceError)
    })

    it('rechaza un nombre que no es texto o está vacío', async () => {
        await expect(service.create(input({ name: 5 }))).rejects.toThrow(DishNameRequiredError)
        await expect(service.create(input({ name: '   ' }))).rejects.toThrow(DishNameRequiredError)
    })

    it('rechaza un nombre de más de 100 caracteres y acepta 100', async () => {
        await expect(service.create(input({ name: 'a'.repeat(101) }))).rejects.toThrow(NameTooLongError)
        await expect(service.create(input({ name: 'a'.repeat(100) }))).resolves.toBeDefined()
    })

    it('rechaza ingredients que no es una lista', async () => {
        await expect(service.create(input({ ingredients: 'x' }))).rejects.toThrow(InvalidDishIngredientError)
    })

    it.each([0, -1, NaN, Infinity, '2', null])('rechaza una cantidad de ingrediente %s', async (quantity) => {
        await expect(service.create(input({ ingredients: [{ ingredientId: 'i1', quantity }] })))
            .rejects.toThrow(InvalidDishIngredientError)
    })

    it('rechaza un ingrediente que no existe', async () => {
        await expect(service.create(input({ ingredients: [{ ingredientId: 'fantasma', quantity: 1 }] })))
            .rejects.toThrow(IngredientNotFoundError)
    })

    it('rechaza un ingrediente de otro restaurante como si no existiera', async () => {
        await expect(service.create(input({ ingredients: [{ ingredientId: 'i-otro', quantity: 1 }] })))
            .rejects.toThrow(IngredientNotFoundError)
    })

    it('aplica las mismas reglas al actualizar', async () => {
        const dish = await service.create(input())
        await expect(service.update(dish.id, input({ price: NaN }))).rejects.toThrow(InvalidPriceError)
        await expect(service.update(dish.id, input({ ingredients: [{ ingredientId: 'i-otro', quantity: 1 }] })))
            .rejects.toThrow(IngredientNotFoundError)
    })
})
