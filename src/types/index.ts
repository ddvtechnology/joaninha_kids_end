export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  total_points: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  sale_price: number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export type ProductCategory = 
  | 'VESTIDOS'
  | 'CONJUNTOS'
  | 'MACACAO'
  | 'CALCADOS'
  | 'ACESSORIOS'
  | 'BODIES'
  | 'PIJAMAS'
  | 'CASACOS'
  | 'OUTROS';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'VESTIDOS',
  'CONJUNTOS',
  'MACACAO',
  'CALCADOS',
  'ACESSORIOS',
  'BODIES',
  'PIJAMAS',
  'CASACOS',
  'OUTROS'
];

export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' }
];

export interface Sale {
  id: string;
  customer_id?: string;
  total_amount: number;
  payment_method: PaymentMethod;
  points_earned: number;
  created_at: string;
  created_by: string;
  items: SaleItem[];
  customer?: Customer;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface FinancialSummary {
  revenue: number;
  costs: number;
  profit: number;
  salesCount: number;
  period: string;
}

export interface FinancialTransaction {
  id: string;
  type: 'ENTRADA' | 'SAIDA';
  description: string;
  amount: number;
  created_at: string;
  category: string;
  created_by: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
  created_by: string;
}