import { Injectable, inject, signal, computed } from '@angular/core';
import { Order, OrderStatus } from '../models/order.model';
import { OrderService } from '../services/order.service';
import { firstValueFrom } from 'rxjs';
import { httpErrorMessage } from '@resttek/web-shared';

@Injectable({ providedIn: 'root' })
export class OrderStore {
  private readonly orderService = inject(OrderService);

  private readonly _orders = signal<Order[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly orders = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadOrders(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const orders = await firstValueFrom(this.orderService.getActiveOrders());
      this._orders.set(orders);
    } catch (err: any) {
      this._error.set(httpErrorMessage(err, 'Error al cargar pedidos'));
    } finally {
      this._loading.set(false);
    }
  }

  async updateItemStatus(orderId: string, itemId: string, status: OrderStatus): Promise<void> {
    try {
      await firstValueFrom(this.orderService.updateItemStatus(orderId, itemId, { status }));
      this._orders.update(orders => 
        orders.map(order => {
          if (order.id === orderId) {
            return {
              ...order,
              items: order.items.map(item => 
                item.id === itemId ? { ...item, status } : item
              )
            };
          }
          return order;
        })
      );
    } catch (err: any) {
      this._error.set(httpErrorMessage(err, 'Error al actualizar estado'));
    }
  }

  startPolling(): void {
    this.loadOrders();
    this.pollingInterval = setInterval(() => {
      this.loadOrders();
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
