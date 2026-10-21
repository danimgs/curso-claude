import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRoutes from '@employee/infrastructure/http/auth.routes.js'
import employeeRoutes from '@employee/infrastructure/http/employee.routes.js'
import restaurantEmployeeRoutes from '@employee/infrastructure/http/restaurant-employee.routes.js'
import restaurantRoutes from '@routes/restaurant.routes.js'
import ingredientRoutes from '@routes/ingredient.routes.js'
import dishRoutes from '@routes/dish.routes.js'
import publicRestaurantRoutes from '@routes/restaurant.public.routes.js'
import publicDishRoutes from '@routes/dish.public.routes.js'
import orderRoutes from '@routes/order.routes.js'
import { CORS_ORIGINS } from '@config/env.js'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'

const app = express()

const authLimiter = (max: number, windowMs: number) => rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'TooManyRequests', message: 'Demasiados intentos, inténtalo más tarde' }
})

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: CORS_ORIGINS }))
app.use(express.json({ limit: '100kb' }))

app.use('/api/v1/auth/login', authLimiter(10, 15 * 60 * 1000))
app.use('/api/v1/auth/register', authLimiter(20, 60 * 60 * 1000))

app.use('/api/v1/orders', orderRoutes)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/employees', employeeRoutes)
app.use('/api/v1/public/restaurants', publicRestaurantRoutes)
app.use('/api/v1/public/restaurants/:restaurantId/dishes', publicDishRoutes)
app.use('/api/v1/restaurants', restaurantRoutes)
app.use('/api/v1/restaurants/:restaurantId/ingredients', ingredientRoutes)
app.use('/api/v1/restaurants/:restaurantId/dishes', dishRoutes)
app.use('/api/v1/restaurants/:restaurantId/employees', restaurantEmployeeRoutes)

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.use(errorHandler)

export default app
