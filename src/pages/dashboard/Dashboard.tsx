import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Package, DollarSign, TrendingUp, Calendar, Sun } from 'lucide-react';
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

interface Sale {
  id: string;
  customer?: { name: string };
  items?: { product_name: string }[];
  created_by?: string;
  created_at?: string;
  payment_method?: string;
  total_amount?: number;
}

interface Expense {
  id: string;
  description: string;
  created_by?: string;
  created_at?: string;
  date?: string;
  amount?: number;
  category?: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [stockQuantity, setStockQuantity] = useState(0);
  const [periodSales, setPeriodSales] = useState<Sale[]>([]);
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([]);
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
      .select('*, customer:customers(name), items:sale_items(*)', { count: 'exact' })
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

    // Supondo que exista um campo 'hidden' na tabela 'products' que indica se o produto está oculto
    const { data, error } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('hidden', true); // Aqui estamos filtrando para pegar apenas os produtos não ocultos

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
                {getGreeting()}, {user?.email === "teste@gmail.com" ? "Diego Moreira" : user?.email?.split('@')[0]}!
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
                <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">
                      Cliente: {sale.customer?.name || 'Cliente não identificado'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Produto: {sale.items?.[0]?.product_name || 'Produto não identificado'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Registrado por: {sale.created_by || 'Desconhecido'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sale.created_at ? format(new Date(sale.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                    </p>
                    <p className="text-sm text-gray-500 font-semibold">
                      Método: {sale.payment_method}
                    </p>
                  </div>
                  <span className="text-green-600 font-medium">
                    R$ {sale.total_amount?.toFixed(2) || '0.00'}
                  </span>
                </div>
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
                <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{expense.description}</p>
                    <p className="text-sm text-gray-500">
                      Categoria: {expense.category || 'Não categorizado'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Registrado por: {expense.created_by || 'Desconhecido'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {expense.created_at ? format(new Date(expense.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                    </p>
                  </div>
                  <span className="text-red-600 font-medium">
                    R$ {expense.amount?.toFixed(2) || '0.00'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
export { eventEmitter };