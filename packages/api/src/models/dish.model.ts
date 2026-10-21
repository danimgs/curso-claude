import { InvalidCategoryError, InvalidDishIngredientError } from '@errors/DomainErrors.js'

const VALID_DISH_CATEGORIES = ['entrante', 'principal', 'postre', 'bebida'] as const

export type DishCategoryType = typeof VALID_DISH_CATEGORIES[number]

export interface DishIngredient {
    ingredientId: string
    quantity: number
}

export interface Dish {
    id: string
    name: string
    description: string | null
    price: number
    category: DishCategoryType
    available: boolean
    restaurantId: string
    ingredients: DishIngredient[]
    createdAt: string
    updatedAt: string
}

export function normalizeDishCategory(value: string): DishCategoryType {
    const normalized = value.toLowerCase().trim()
    if (!VALID_DISH_CATEGORIES.includes(normalized as DishCategoryType)) {
        throw new InvalidCategoryError(`Invalid category: ${value}. Must be one of: ${VALID_DISH_CATEGORIES.join(', ')}`)
    }
    return normalized as DishCategoryType
}

export function validateDishIngredient(props: DishIngredient): DishIngredient {
    if (typeof props?.ingredientId !== 'string' || props.ingredientId.trim() === '') {
        throw new InvalidDishIngredientError('Ingredient ID is required')
    }
    if (typeof props.quantity !== 'number' || !Number.isFinite(props.quantity) || props.quantity <= 0) {
        throw new InvalidDishIngredientError('Ingredient quantity must be a positive number')
    }
    return { ingredientId: props.ingredientId, quantity: props.quantity }
}
