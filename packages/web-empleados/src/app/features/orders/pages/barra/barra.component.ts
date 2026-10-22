import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { OrderStore } from '../../store/order.store';
import { TableStore } from '../../../tables/store/table.store';

@Component({
  selector: 'app-barra',
  standalone: true,
  templateUrl: './barra.component.html',
  styleUrl: './barra.component.css'
})
export class BarraComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly orderStore = inject(OrderStore);
  readonly tableStore = inject(TableStore);

  ngOnInit(): void {
    if (this.authStore.user()?.restaurantId) {
      this.orderStore.startPolling();
      // Solo camarero y manager pueden listar mesas (el resto recibiría 403); sin número se muestra "Mesa —".
      const role = this.authStore.userRole();
      if (role === 'camarero' || role === 'manager') {
        this.tableStore.loadTables();
      }
    }
  }

  ngOnDestroy(): void {
    this.orderStore.stopPolling();
  }

  get pendingOrders() {
    return this.orderStore.orders().map(order => ({
      ...order,
      items: order.items.filter(item => 
        item.dishCategory?.toLowerCase() === 'bebida' && item.status === 'pendiente'
      )
    })).filter(order => order.items.length > 0);
  }

  markReady(orderId: string, itemId: string): void {
    this.orderStore.updateItemStatus(orderId, itemId, 'listo');
  }

  getStatusClass(status: string): string {
    return `badge badge-${status}`;
  }
}
