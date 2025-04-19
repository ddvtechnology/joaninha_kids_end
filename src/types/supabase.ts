export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          total_points: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          total_points?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          total_points?: number
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          description: string
          amount: number
          category: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          description: string
          amount: number
          category: string
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          description?: string
          amount?: number
          category?: string
          date?: string
          created_at?: string
        }
      }
      financial_transactions: {
        Row: {
          id: string
          type: 'ENTRADA' | 'SAIDA'
          description: string
          amount: number
          category: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          type: 'ENTRADA' | 'SAIDA'
          description: string
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          type?: 'ENTRADA' | 'SAIDA'
          description?: string
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category: 'VESTIDOS' | 'CONJUNTOS' | 'MACACAO' | 'CALCADOS' | 'ACESSORIOS' | 'BODIES' | 'PIJAMAS' | 'CASACOS' | 'OUTROS'
          description: string | null
          image_url: string | null
          sale_price: number
          cost_price: number
          stock_quantity: number
          min_stock: number
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
          brand: string
          size: string
          hidden: boolean
          reference: string
        }
        Insert: {
          id?: string
          name: string
          category: 'VESTIDOS' | 'CONJUNTOS' | 'MACACAO' | 'CALCADOS' | 'ACESSORIOS' | 'BODIES' | 'PIJAMAS' | 'CASACOS' | 'OUTROS'
          description?: string | null
          image_url?: string | null
          sale_price: number
          cost_price: number
          stock_quantity?: number
          min_stock?: number
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          brand?: string
          size: string
          hidden?: boolean
          reference?: string
        }
        Update: {
          id?: string
          name?: string
          category?: 'VESTIDOS' | 'CONJUNTOS' | 'MACACAO' | 'CALCADOS' | 'ACESSORIOS' | 'BODIES' | 'PIJAMAS' | 'CASACOS' | 'OUTROS'
          description?: string | null
          image_url?: string | null
          sale_price?: number
          cost_price?: number
          stock_quantity?: number
          min_stock?: number
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          brand?: string
          size?: string
          hidden?: boolean
          reference?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          created_at: string | null
        }
        Insert: {
          id?: string
          sale_id?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          created_at?: string | null
        }
        Update: {
          id?: string
          sale_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string | null
        }
      }
      sales: {
        Row: {
          id: string
          customer_id: string | null
          total_amount: number
          payment_method: 'PIX' | 'DINHEIRO' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO'
          points: number
          points_earned: number
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          total_amount: number
          payment_method: 'PIX' | 'DINHEIRO' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO'
          points?: number
          points_earned?: number
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          total_amount?: number
          payment_method?: 'PIX' | 'DINHEIRO' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO'
          points?: number
          points_earned?: number
          created_at?: string | null
          created_by?: string | null
        }
      }
      user_profiles: {
        Row: {
          user_id: string
          display_name: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          display_name: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          display_name?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      payment_method: 'PIX' | 'DINHEIRO' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO'
      product_category: 'VESTIDOS' | 'CONJUNTOS' | 'MACACAO' | 'CALCADOS' | 'ACESSORIOS' | 'BODIES' | 'PIJAMAS' | 'CASACOS' | 'OUTROS'
      transaction_type: 'ENTRADA' | 'SAIDA'
    }
  }
}
