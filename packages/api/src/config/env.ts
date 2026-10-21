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
