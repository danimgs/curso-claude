import { describe, it, expect } from 'vitest'
import { HttpErrorResponse } from '@angular/common/http'
import { httpErrorMessage } from './error-message'

describe('httpErrorMessage', () => {
  it.each([
    [0, 'No se ha podido conectar con el servidor'],
    [400, 'La petición no es válida'],
    [401, 'Tu sesión ha caducado. Vuelve a iniciar sesión'],
    [403, 'No tienes permiso para realizar esta acción'],
    [404, 'No se ha encontrado lo que buscas'],
    [429, 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos'],
    [500, 'Error del servidor. Inténtalo de nuevo más tarde'],
    [503, 'Error del servidor. Inténtalo de nuevo más tarde']
  ])('el estado %i da un mensaje fijo', (status, expected) => {
    expect(httpErrorMessage(new HttpErrorResponse({ status }), 'x')).toBe(expected)
  })

  it('no incluye la URL ni el detalle del servidor', () => {
    const error = new HttpErrorResponse({
      status: 500,
      url: 'http://localhost:3000/api/v1/orders/active?restaurantId=r1',
      error: { message: 'SQLITE_ERROR: no such table' }
    })
    const message = httpErrorMessage(error, 'Error al cargar pedidos')
    expect(message).not.toContain('localhost')
    expect(message).not.toContain('restaurantId')
    expect(message).not.toContain('SQLITE')
    expect(message).not.toContain('Http failure')
  })

  it('usa el texto de respaldo para un error que no es HTTP', () => {
    expect(httpErrorMessage(new Error('TypeError interno'), 'Error al cargar pedidos')).toBe('Error al cargar pedidos')
    expect(httpErrorMessage(undefined, 'Error al cargar pedidos')).toBe('Error al cargar pedidos')
    expect(httpErrorMessage('texto', 'Error al cargar pedidos')).toBe('Error al cargar pedidos')
  })

  it('usa el texto de respaldo para un estado sin mensaje propio', () => {
    expect(httpErrorMessage(new HttpErrorResponse({ status: 418 }), 'Error al cargar pedidos')).toBe('Error al cargar pedidos')
  })
})
