import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore, httpErrorMessage } from '@resttek/web-shared';
import { Table, TableStatus } from '../models/table.model';
import { TableService } from '../services/table.service';

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);
  private readonly authStore = inject(AuthStore);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadTables(): Promise<void> {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (!restaurantId) return;

    this._loading.set(true);
    this._error.set(null);
    try {
      const tables = await firstValueFrom(this.tableService.getTables(restaurantId));
      this._tables.set(tables);
    } catch (err: any) {
      this._error.set(httpErrorMessage(err, 'Error al cargar mesas'));
    } finally {
      this._loading.set(false);
    }
  }

  async updateStatus(tableId: string, status: TableStatus): Promise<void> {
    const restaurantId = this.authStore.user()?.restaurantId;
    if (!restaurantId) return;

    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.tableService.updateStatus(restaurantId, tableId, { status }));
      this._tables.update(tables => tables.map(table => (table.id === tableId ? updated : table)));
    } catch (err: any) {
      this._error.set(httpErrorMessage(err, 'Error al actualizar el estado de la mesa'));
      // La mesa pudo borrarse o cambiar entre sondeos: se recarga la lista para reflejar la realidad.
      if (err?.error?.error === 'TableNotFoundError') await this.loadTables();
    }
  }

  startPolling(): void {
    this.stopPolling();
    this.loadTables();
    this.pollingInterval = setInterval(() => {
      this.loadTables();
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
