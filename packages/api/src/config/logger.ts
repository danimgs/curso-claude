import pino from 'pino'

// Logs estructurados (JSON). Nunca se registran contraseñas ni cabeceras de autorización.
export const logger = pino({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    redact: ['password', 'passwordRaw', 'req.headers.authorization']
})
