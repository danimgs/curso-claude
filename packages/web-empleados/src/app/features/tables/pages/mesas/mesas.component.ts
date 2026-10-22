import { Component, inject } from '@angular/core';
import { TableStore } from '../../store/table.store';
import { TABLE_STATUSES, TableStatus } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent {
  readonly tableStore = inject(TableStore);
  readonly statuses = TABLE_STATUSES;

  changeStatus(tableId: string, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as TableStatus;
    this.tableStore.updateStatus(tableId, status);
  }
}
