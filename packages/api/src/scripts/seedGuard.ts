// El seed crea cuentas con la contraseña igual al email (p. ej. admin@resttek.com):
// nunca debe ejecutarse contra una base de datos de producción.
export function assertSeedAllowed(env: { NODE_ENV?: string | undefined } = process.env): void {
    if (env.NODE_ENV === 'production') {
        throw new Error('El seed no se puede ejecutar en producción: crea cuentas con contraseñas conocidas')
    }
}
