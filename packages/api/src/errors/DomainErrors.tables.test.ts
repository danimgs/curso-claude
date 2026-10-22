import { describe, it, expect } from 'vitest'
import {
    TableNotFoundError,
    InvalidTableNumberError,
    InvalidCapacityError,
    InvalidTableDescriptionError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    TableOccupiedError,
    TableNotOccupiedError,
    InvalidPartySizeError
} from './DomainErrors.js'
import { AppError } from './AppError.js'

describe('Errores de dominio de mesas', () => {
    const cases: [AppError, string, string][] = [
        [new TableNotFoundError(), 'TableNotFoundError', 'Mesa no encontrada'],
        [new InvalidTableNumberError(), 'InvalidTableNumberError', 'El número de mesa debe ser un entero mayor que 0'],
        [new InvalidCapacityError(), 'InvalidCapacityError', 'La capacidad debe ser un entero entre 1 y 20'],
        [new InvalidTableDescriptionError(), 'InvalidTableDescriptionError', 'La descripción debe tener como máximo 200 caracteres'],
        [new DuplicatedTableNumberError(), 'DuplicatedTableNumberError', 'Ya existe una mesa con ese número en el restaurante'],
        [new TableNotAvailableError(), 'TableNotAvailableError', 'La mesa ya no está disponible'],
        [new TableOccupiedError(), 'TableOccupiedError', 'No se puede eliminar una mesa ocupada'],
        [new TableNotOccupiedError(), 'TableNotOccupiedError', 'La mesa no está ocupada'],
        [new InvalidPartySizeError(), 'InvalidPartySizeError', 'El número de personas debe ser un entero entre 1 y 20']
    ]

    it.each(cases)('%o tiene el nombre y el mensaje del contrato', (error, name, message) => {
        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.message).toBe(message)
    })
})
