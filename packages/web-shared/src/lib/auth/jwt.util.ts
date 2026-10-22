function decodePayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0))
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Devuelve `exp` (segundos desde epoch) del JWT, o null si no se puede leer. No verifica la firma. */
export function decodeJwtExpiry(token: string): number | null {
  const exp = decodePayload(token)?.['exp']
  return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
}

/** Un token ilegible o sin `exp` se considera caducado. Es solo una comodidad de la UI: la API valida el token. */
export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  const exp = decodeJwtExpiry(token)
  return exp === null || exp * 1000 <= nowMs
}
