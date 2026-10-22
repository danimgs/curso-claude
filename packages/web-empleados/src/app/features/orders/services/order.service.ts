import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, UpdateOrderItemStatusDto } from '../models/order.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  // El restaurante lo deduce la API del token: el cliente no envía restaurantId.
  getActiveOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/active`);
  }

  updateItemStatus(orderId: string, itemId: string, dto: UpdateOrderItemStatusDto): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/${orderId}/items/${itemId}/status`,
      dto
    );
  }
}
