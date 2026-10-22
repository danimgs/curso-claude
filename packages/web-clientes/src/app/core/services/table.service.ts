import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import { API_URL } from '@resttek/web-shared'
import { PublicTable, Table } from '../models/table.model'

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient)
  private readonly apiUrl = inject(API_URL)

  getAvailable(restaurantId: string, partySize: number): Observable<PublicTable[]> {
    return this.http.get<PublicTable[]>(`${this.apiUrl}/public/restaurants/${restaurantId}/tables`, {
      params: { partySize }
    })
  }

  occupy(restaurantId: string, tableId: string): Observable<Table> {
    return this.http.post<Table>(`${this.apiUrl}/restaurants/${restaurantId}/tables/${tableId}/occupy`, {})
  }
}
