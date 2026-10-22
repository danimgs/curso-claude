import { HttpErrorResponse } from '@angular/common/http'

const MESSAGES: Record<number, string> = {
  0: 'No se ha podido conectar con el servidor',
  400: 'La petición no es válida',
  401: 'Tu sesión ha caducado. Vuelve a iniciar sesión',
  403: 'No tienes permiso para realizar esta acción',
  404: 'No se ha encontrado lo que buscas',
  429: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos'
}

/**
 * Mensaje apto para mostrar al usuario a partir de un error HTTP. Se elige solo por el código de
 * estado: `HttpErrorResponse.message` incluye la URL completa y el detalle del servidor, que no
 * deben llegar a la pantalla.
 */
export function httpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback
  if (error.status >= 500) return 'Error del servidor. Inténtalo de nuevo más tarde'
  return MESSAGES[error.status] ?? fallback
}
