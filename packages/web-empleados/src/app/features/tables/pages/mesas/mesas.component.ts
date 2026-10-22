import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { OrderStore } from '../../../orders/store/order.store';
import { Order, OrderItem } from '../../../orders/models/order.model';
import { TableStore } from '../../store/table.store';
import { TABLE_STATUSES, Table, TableStatus } from '../../models/table.model';

interface TableOrderView {
  id: string
  items: OrderItem[]
  delivered: number
}

interface TableCard {
  table: Table
  orders: TableOrderView[]
}

function toOrderView(order: Order): TableOrderView {
  const delivered = order.items.filter(item => item.status === 'entregado').length;
  // Los ítems ya entregados van al final (atenuados en la plantilla); sort es estable.
  const items = [...order.items].sort(
    (a, b) => Number(a.status === 'entregado') - Number(b.status === 'entregado')
  );
  return { id: order.id, items, delivered };
}

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);
  readonly statuses = TABLE_STATUSES;

  // Pedidos activos agrupados por mesa; solo se muestran en las mesas ocupadas.
  readonly cards = computed<TableCard[]>(() => {
    const ordersByTable = new Map<string, TableOrderView[]>();
    for (const order of this.orderStore.orders()) {
      if (!order.tableId) continue;
      const views = ordersByTable.get(order.tableId) ?? [];
      views.push(toOrderView(order));
      ordersByTable.set(order.tableId, views);
    }
    return this.tableStore.tables().map(table => ({
      table,
      orders: table.status === 'ocupada' ? ordersByTable.get(table.id) ?? [] : []
    }));
  });

  ngOnInit(): void {
    if (this.authStore.user()?.restaurantId) {
      this.tableStore.startPolling();
      this.orderStore.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
    this.orderStore.stopPolling();
  }

  changeStatus(tableId: string, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as TableStatus;
    this.tableStore.updateStatus(tableId, status);
  }
}
