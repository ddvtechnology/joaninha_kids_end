import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Package, DollarSign, TrendingUp, Sun, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Event emitter for cross-component communication
const eventEmitter = {
  events: {} as Record<string, Function[]>,
  subscribe(event: string, fn: Function) {
    this.events[event] = this.events[event] || [];
    this.events[event].push(fn);
  },
  unsubscribe(event: string, fn: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(f => f !== fn);
  },
  emit(event: string, data?: any) {
    if (!this.events[event]) return;
    this.events[event].forEach(fn => fn(data));
  }
};

interface FinancialSummary {
  revenue: number;
  costs: number;
  profit: number;
  salesCount: number;
  period: string;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Sale {
  id: string;
  customer?: { name: string; phone?: string };
  items?: SaleItem[];
  created_by?: string;
  created_at?: string;
  payment_method?: string;
  total_amount?: number;
  points_earned?: number;
  seller?: string;
}

interface Expense {
  id: string;
  description: string;
  created_by?: string;
  created_at?: string;
  date?: string;
  amount?: number;
  category?: string;
  bill_id?: string;
}

const translatePaymentMethod = (method: string | undefined) => {
  const methods: Record<string, string> = {
    PIX: 'PIX',
    DINHEIRO: 'Dinheiro',
    CARTAO_DEBITO: 'Cartão de Débito',
    CARTAO_CREDITO: 'Cartão de Crédito',
  };
  return method ? (methods[method] || method) : '-';
};

const formatCurrency = (value: number | undefined) =>
  `R$ ${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Formata data da despesa (YYYY-MM-DD ou ISO): evita mudar de dia por fuso. */
function formatExpenseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const datePart = dateStr.slice(0, 10);
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return '-';
    const localDate = new Date(y, m - 1, d);
    if (Number.isNaN(localDate.getTime())) return '-';
    return format(localDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return '-';
  }
}

const Dashboard = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [stockQuantity, setStockQuantity] = useState(0);
  const [periodSales, setPeriodSales] = useState<Sale[]>([]);
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    revenue: 0,
    costs: 0,
    profit: 0,
    salesCount: 0,
    period: 'day'
  });

  // Function to get date range based on period
  const getDateRange = useCallback((period: string, referenceDate = new Date()): [Date, Date] => {
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'day':
        startDate = startOfDay(referenceDate);
        endDate = endOfDay(referenceDate);
        break;
      case 'week':
        startDate = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(referenceDate, { weekStartsOn: 1 }); // Sunday
        break;
      case 'month':
        startDate = startOfMonth(referenceDate);
        endDate = endOfMonth(referenceDate);
        break;
      case 'year':
        startDate = startOfYear(referenceDate);
        endDate = endOfYear(referenceDate);
        break;
      default:
        startDate = startOfDay(referenceDate);
        endDate = endOfDay(referenceDate);
    }

    return [startDate, endDate];
  }, []);

  // Fetch financial summary and transactions for the selected period
  const fetchPeriodData = useCallback(async () => {
    if (!user) return;

    const [startDate, endDate] = getDateRange(selectedPeriod);

    // Format dates for expense queries (YYYY-MM-DD)
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Current period revenue (from sales)
    const { data: salesData, error: salesError, count } = await supabase
      .from('sales')
      .select('*, customer:customers(name, phone), items:sale_items(*)', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('Erro ao buscar vendas:', salesError);
      return;
    }

    setPeriodSales(salesData || []);
    const revenue = salesData?.reduce((acc, item) => acc + (item.total_amount || 0), 0) || 0;
    const salesCount = count || 0;

    // Current period expenses
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('created_at', { ascending: false });

    if (expensesError) {
      console.error('Erro ao buscar despesas:', expensesError);
      return;
    }

    setPeriodExpenses(expensesData || []);
    const costs = expensesData?.reduce((acc, item) => acc + parseFloat(item.amount), 0) || 0;

    // Calculate profit
    const profit = revenue - costs;

    setFinancialSummary({
      revenue,
      costs,
      profit,
      salesCount,
      period: selectedPeriod
    });
  }, [selectedPeriod, user, getDateRange]);

  // Update the clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data when period changes
  useEffect(() => {
    fetchPeriodData();
  }, [fetchPeriodData]);

  // Listen for expense/sales change events
  useEffect(() => {
    const onDataChange = () => {
      fetchPeriodData();
    };
    eventEmitter.subscribe('expenseChanged', onDataChange);
    eventEmitter.subscribe('saleChanged', onDataChange);
    return () => {
      eventEmitter.unsubscribe('expenseChanged', onDataChange);
      eventEmitter.unsubscribe('saleChanged', onDataChange);
    };
  }, [fetchPeriodData]);

  // Fetch stock quantity
  const fetchStockQuantity = useCallback(async () => {
    if (!user) return;

    // hidden=false = produtos visíveis/ativos; hidden=true = ocultos/encerrados
    const { data, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('hidden', false);

    if (error) {
      console.error('Erro ao buscar estoque:', error);
      return;
    }

    const totalStock = data?.reduce((acc, item) => acc + (item.stock_quantity || 0), 0) || 0;
    setStockQuantity(totalStock);
  }, [user]);



  // Fetch initial data
  useEffect(() => {
    fetchStockQuantity();
  }, [fetchStockQuantity]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const weekday = format(currentTime, "EEEE", { locale: ptBR });

  // Data for stats cards
  const stats = [
    {
      title: 'Faturamento',
      value: `R$ ${financialSummary.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
    },
    {
      title: 'Custos',
      value: `R$ ${financialSummary.costs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
    },
    {
      title: 'Lucro',
      value: `R$ ${financialSummary.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: BarChart,
    },
    {
      title: 'Produtos em Estoque',
      value: stockQuantity.toString(),
      icon: Package,
    },
  ];

  // Format period label for display
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'day': return 'de Hoje';
      case 'week': return 'da Semana';
      case 'month': return 'do Mês';
      case 'year': return 'do Ano';
      default: return '';
    }
  };

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Sun className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {getGreeting()}, {user?.email === "joannamarques.jm19@gmail.com"
                  ? "Joanna Marques"
                  : user?.email === "michellyc.gomes@hotmail.com"
                    ? "Michelly Gomes"
                    : user?.email?.split('@')[0]}!
              </h2>

              <p className="text-gray-500">Hoje é {weekday}, tenha um ótimo dia!</p>
            </div>

          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {currentTime.toLocaleTimeString('pt-BR')}
            </p>
            <p className="text-sm text-gray-500">
              {format(currentTime, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Resumo Financeiro</h2>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-4 py-2 border rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
        >
          <option value="day">Hoje</option>
          <option value="week">Esta Semana</option>
          <option value="month">Este Mês</option>
          <option value="year">Este Ano</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl">
                <stat.icon className="h-6 w-6 text-pink-600" />
              </div>
            </div>
            <h2 className="text-gray-500 text-sm font-medium">{stat.title}</h2>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Entries and Expenses based on selected period */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Entradas {getPeriodLabel()}</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {periodSales.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhuma venda registrada neste período</p>
            ) : (
              periodSales.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setSelectedSale(sale)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-left cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      Cliente: {sale.customer?.name || 'Cliente não identificado'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {sale.items && sale.items.length > 0
                        ? `${sale.items.length} ${sale.items.length === 1 ? 'produto' : 'produtos'}: ${sale.items[0].product_name}${sale.items.length > 1 ? ' e outros' : ''}`
                        : 'Sem itens registrados'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sale.created_at ? format(new Date(sale.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                      {' · '}
                      {translatePaymentMethod(sale.payment_method)}
                    </p>
                    <p className="text-xs text-pink-600 mt-1">Clique para ver detalhes</p>
                  </div>
                  <span className="text-green-600 font-medium ml-4 shrink-0">
                    {formatCurrency(sale.total_amount)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Saídas {getPeriodLabel()}</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {periodExpenses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhuma despesa registrada neste período</p>
            ) : (
              periodExpenses.map((expense) => (
                <button
                  key={expense.id}
                  type="button"
                  onClick={() => setSelectedExpense(expense)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-left cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                    <p className="text-sm text-gray-500">
                      {expense.category || 'Não categorizado'}
                      {' · '}
                      {formatExpenseDate(expense.date)}
                    </p>
                    <p className="text-xs text-pink-600 mt-1">Clique para ver detalhes</p>
                  </div>
                  <span className="text-red-600 font-medium ml-4 shrink-0">
                    {formatCurrency(expense.amount)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal — detalhes da venda (entrada) */}
      {selectedSale && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSale(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Detalhes da Venda</h3>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">
                    {selectedSale.customer?.name || 'Cliente não identificado'}
                  </p>
                </div>
                {selectedSale.customer?.phone && (
                  <div>
                    <p className="text-gray-500">Telefone</p>
                    <p className="font-medium text-gray-900">{selectedSale.customer.phone}</p>
                  </div>
                )}
                {selectedSale.seller && (
                  <div>
                    <p className="text-gray-500">Vendedora</p>
                    <p className="font-medium text-gray-900">{selectedSale.seller}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Método de pagamento</p>
                  <p className="font-medium text-gray-900">
                    {translatePaymentMethod(selectedSale.payment_method)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Data e hora</p>
                  <p className="font-medium text-gray-900">
                    {selectedSale.created_at
                      ? format(new Date(selectedSale.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Registrado por</p>
                  <p className="font-medium text-gray-900">{selectedSale.created_by || 'Desconhecido'}</p>
                </div>
                {(selectedSale.points_earned ?? 0) > 0 && (
                  <div>
                    <p className="text-gray-500">Pontos ganhos</p>
                    <p className="font-medium text-gray-900">{selectedSale.points_earned}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Produtos</p>
                {selectedSale.items && selectedSale.items.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left p-3 font-medium">Produto</th>
                          <th className="text-center p-3 font-medium">Qtd</th>
                          <th className="text-right p-3 font-medium">Unit.</th>
                          <th className="text-right p-3 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedSale.items.map((item) => (
                          <tr key={item.id}>
                            <td className="p-3 text-gray-900">{item.product_name}</td>
                            <td className="p-3 text-center text-gray-700">{item.quantity}</td>
                            <td className="p-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                            <td className="p-3 text-right font-medium text-gray-900">
                              {formatCurrency(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Nenhum item registrado</p>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold text-gray-900">Total da venda</span>
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(selectedSale.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal — detalhes da despesa (saída) */}
      {selectedExpense && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedExpense(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Detalhes da Despesa</h3>
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <p className="text-gray-500 text-sm">Descrição</p>
                <p className="font-medium text-gray-900 text-lg">{selectedExpense.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Categoria</p>
                  <p className="font-medium text-gray-900">
                    {selectedExpense.category || 'Não categorizado'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Data da despesa</p>
                  <p className="font-medium text-gray-900">{formatExpenseDate(selectedExpense.date)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Registrado por</p>
                  <p className="font-medium text-gray-900">{selectedExpense.created_by || 'Desconhecido'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Registrado em</p>
                  <p className="font-medium text-gray-900">
                    {selectedExpense.created_at
                      ? format(new Date(selectedExpense.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                {selectedExpense.bill_id && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Origem</p>
                    <p className="font-medium text-gray-900">Conta a pagar (paga)</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold text-gray-900">Valor</span>
                <span className="text-xl font-bold text-red-600">
                  {formatCurrency(selectedExpense.amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
export { eventEmitter };