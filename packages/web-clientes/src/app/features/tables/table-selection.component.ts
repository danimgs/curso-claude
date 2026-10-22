import { Component, inject, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { TableService } from '../../core/services/table.service'
import { CartStore } from '../../core/store/cart.store'
import { PublicTable } from '../../core/models/table.model'

const MIN_PARTY_SIZE = 1
const MAX_PARTY_SIZE = 20

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>Elige tu mesa</h1>
          <p>Indica cuántas personas sois y selecciona una mesa libre</p>
        </div>
      </div>

      <div class="search card">
        <div class="form-group">
          <label for="partySize">Número de personas</label>
          <input id="partySize" type="number" class="form-control" [min]="minPartySize" [max]="maxPartySize"
                 [ngModel]="partySize()" (ngModelChange)="partySize.set($event)" />
        </div>
        <button class="btn btn-primary" [disabled]="searching()" (click)="search()">
          {{ searching() ? 'Buscando...' : 'Buscar mesas' }}
        </button>
      </div>

      @if (notice()) {
        <div class="notice">{{ notice() }}</div>
      }

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (searched()) {
        @if (tables().length === 0) {
          <div class="empty-state card">
            <p>No hay mesas libres para {{ searchedPartySize() }} personas</p>
          </div>
        } @else {
          <div class="table-grid">
            @for (table of tables(); track table.id) {
              <button type="button" class="table-card card" [class.selected]="selectedId() === table.id"
                      (click)="selectedId.set(table.id)">
                <strong>Mesa {{ table.number }}</strong>
                <span class="capacity">Capacidad: {{ table.capacity }}</span>
                @if (table.description) {
                  <span class="description">{{ table.description }}</span>
                }
              </button>
            }
          </div>
          <button class="btn btn-primary continue" [disabled]="!selectedId() || occupying()" (click)="continue()">
            {{ occupying() ? 'Reservando mesa...' : 'Continuar' }}
          </button>
        }
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .search {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 20px;
    }
    .search .form-group {
      margin-bottom: 0;
      flex: 1;
    }
    .notice {
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: var(--radius-sm);
      background: var(--green-glow);
      color: var(--green-light);
    }
    .table-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .table-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px;
      text-align: left;
      color: var(--text-primary);
      transition: all var(--transition);
    }
    .table-card:hover,
    .table-card.selected {
      border-color: var(--green-medium);
    }
    .table-card.selected {
      background: var(--green-glow);
    }
    .capacity, .description {
      font-size: 13px;
      color: var(--text-muted);
    }
    .continue {
      width: 100%;
      justify-content: center;
    }
  `]
})
export class TableSelectionComponent {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly cartStore = inject(CartStore)

  readonly minPartySize = MIN_PARTY_SIZE
  readonly maxPartySize = MAX_PARTY_SIZE

  readonly partySize = signal<number | null>(null)
  readonly searchedPartySize = signal<number | null>(null)
  readonly tables = signal<PublicTable[]>([])
  readonly selectedId = signal<string | null>(null)
  readonly searched = signal(false)
  readonly searching = signal(false)
  readonly occupying = signal(false)
  readonly error = signal<string | null>(null)
  // Aviso enviado por quien navega aquí (p. ej. el carrito cuando la mesa ha sido liberada)
  readonly notice = signal<string | null>(
    (this.router.getCurrentNavigation()?.extras.state?.['message'] as string | undefined) ?? null
  )

  private get restaurantId(): string {
    return this.route.snapshot.paramMap.get('id')!
  }

  search(): void {
    const partySize = this.partySize()
    if (!Number.isInteger(partySize) || partySize! < MIN_PARTY_SIZE || partySize! > MAX_PARTY_SIZE) {
      this.error.set(`Indica un número de personas entre ${MIN_PARTY_SIZE} y ${MAX_PARTY_SIZE}`)
      return
    }
    this.loadTables(partySize!)
  }

  continue(): void {
    const tableId = this.selectedId()
    if (!tableId) return

    this.occupying.set(true)
    this.error.set(null)

    this.tableService.occupy(this.restaurantId, tableId).subscribe({
      next: (table) => {
        this.cartStore.setTable(table)
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err) => {
        this.occupying.set(false)
        if (err.error?.error === 'TableNotAvailableError') {
          this.loadTables(this.searchedPartySize()!, 'La mesa ya no está disponible')
        } else {
          this.error.set('No se ha podido reservar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }

  private loadTables(partySize: number, message: string | null = null): void {
    this.searching.set(true)
    this.error.set(message)
    this.selectedId.set(null)

    this.tableService.getAvailable(this.restaurantId, partySize).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedPartySize.set(partySize)
        this.searched.set(true)
        this.searching.set(false)
      },
      error: () => {
        this.error.set('Error al buscar mesas libres')
        this.searching.set(false)
      }
    })
  }
}
