import type { Request, Response, NextFunction } from 'express'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'

export class TableController {
    constructor(private readonly tableService: TableService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const body = req.body ?? {}
            const table = await this.tableService.create({
                restaurantId: req.params.restaurantId as string,
                number: body.number,
                capacity: body.capacity,
                description: body.description,
                status: body.status
            })
            res.status(201).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.findByRestaurantId(req.params.restaurantId as string)
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.findById(req.params.id as string, req.params.restaurantId as string)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const body = req.body ?? {}
            const table = await this.tableService.update(req.params.id as string, req.params.restaurantId as string, {
                number: body.number,
                capacity: body.capacity,
                description: body.description,
                status: body.status
            })
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.tableService.delete(req.params.id as string, req.params.restaurantId as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.updateStatus(req.params.id as string, req.params.restaurantId as string, req.body?.status)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    occupy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.occupy(req.params.id as string, req.params.restaurantId as string)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAvailable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.findAvailable(req.params.restaurantId as string, req.query.partySize)
            res.status(200).json(tables.map(t => this.toPublicJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    private toJSON(table: Table) {
        return {
            id: table.id,
            restaurantId: table.restaurantId,
            number: table.number,
            description: table.description,
            capacity: table.capacity,
            status: table.status,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }
    }

    // El listado público solo muestra mesas libres: no expone estado, restaurante ni fechas
    private toPublicJSON(table: Table) {
        return {
            id: table.id,
            number: table.number,
            description: table.description,
            capacity: table.capacity
        }
    }
}
