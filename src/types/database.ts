export type ProductoCategoria =
  | 'Bocadillos' | 'Pulgas' | 'Sandwiches' | 'Croissants'
  | 'Hamburguesas y Perritos' | 'Arepas' | 'Papas Locas' | 'Tapas'
  | 'Tablas' | 'Salchichas' | 'Bebidas Refrescos' | 'Agua'
  | 'Zumos y Batidos' | 'Cervezas' | 'Vino' | 'Cafés' | 'Infusiones'
  | 'Dulces y Bollería' | 'Snacks' | 'Postres' | 'Menú' | 'Extras'
  | 'Extras Papas Locas' | 'Suplementos Menú'

export interface Producto {
  id: number
  nombre: string
  categoria: ProductoCategoria
  precio: number
  activo: boolean
  created_at: string
}

export interface MenuDia {
  id: number
  tipo: string
  descripcion: string
  updated_at: string
}

export interface ProductoAgotado {
  id: number
  nombre: string
  created_at: string
}

export interface NumeroBloqueado {
  id: number
  numero: string
  motivo: string | null
  created_at: string
}

export interface NumeroAdmin {
  id: number
  numero: string
  nombre: string | null
  created_at: string
}

export interface Pedido {
  id: number
  nombre: string | null
  telefono: string | null
  empresa: string | null
  direccion: string | null
  zona: string | null
  hora_entrega: string | null
  forma_pago: string | null
  total: number | null
  estado: string | null
  created_at: string
}

export interface KdsTiempo {
  id: number
  pedido_id: number
  pantalla: 'cocina' | 'barra'
  iniciado_at: string
  listo_at: string | null
  tiempo_segundos: number | null
  created_at: string
}

export interface ProductoPedido {
  id: number
  pedido_id: number
  nombre: string
  cantidad: number
  precio_unitario: number | null
  modificaciones: string | null
}

// Supabase GenericSchema requiere Tables, Views, Functions, Enums, CompositeTypes
// y cada tabla requiere Relationships: [] para que los generics resuelvan
export interface Database {
  public: {
    Tables: {
      productos: {
        Row: Producto
        Insert: Omit<Producto, 'id' | 'created_at'>
        Update: Partial<Omit<Producto, 'id' | 'created_at'>>
        Relationships: []
      }
      menu_dia: {
        Row: MenuDia
        Insert: Pick<MenuDia, 'tipo' | 'descripcion'>
        Update: Partial<Pick<MenuDia, 'tipo' | 'descripcion'>>
        Relationships: []
      }
      productos_agotados: {
        Row: ProductoAgotado
        Insert: Pick<ProductoAgotado, 'nombre'>
        Update: Pick<ProductoAgotado, 'nombre'>
        Relationships: []
      }
      numeros_bloqueados: {
        Row: NumeroBloqueado
        Insert: Pick<NumeroBloqueado, 'numero'> & { motivo?: string | null }
        Update: Partial<Pick<NumeroBloqueado, 'numero' | 'motivo'>>
        Relationships: []
      }
      numeros_admin: {
        Row: NumeroAdmin
        Insert: Pick<NumeroAdmin, 'numero'> & { nombre?: string | null }
        Update: Partial<Pick<NumeroAdmin, 'numero' | 'nombre'>>
        Relationships: []
      }
      pedidos: {
        Row: Pedido
        Insert: Omit<Pedido, 'id' | 'created_at'>
        Update: Pick<Pedido, 'estado'>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
