const DEFAULT_JWT_SECRET = 'super-secret-resttek-key'

function resolveJwtSecret(): string {
    const secret = process.env.JWT_SECRET
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction && (!secret || secret === DEFAULT_JWT_SECRET)) {
        throw new Error('JWT_SECRET es obligatorio en producción y no puede ser el valor por defecto')
    }

    if (!secret) {
        console.warn('JWT_SECRET no definido: se usa el secreto de desarrollo (no apto para producción)')
        return DEFAULT_JWT_SECRET
    }

    return secret
}

export const JWT_SECRET: string = resolveJwtSecret()

const DEV_CORS_ORIGINS = ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4202']

function resolveCorsOrigins(): string[] {
    const configured = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin !== '')

    if (configured.length > 0) return configured
    return process.env.NODE_ENV === 'production' ? [] : DEV_CORS_ORIGINS
}

export const CORS_ORIGINS: string[] = resolveCorsOrigins()

export const JWT_ISSUER = 'resttek'
export const JWT_AUDIENCE = 'resttek-web'

function resolveJwtExpiresInSeconds(): number {
    const seconds = Number(process.env.JWT_EXPIRES_IN_SECONDS)
    return Number.isInteger(seconds) && seconds > 0 ? seconds : 3600
}

export const JWT_EXPIRES_IN_SECONDS: number = resolveJwtExpiresInSeconds()
