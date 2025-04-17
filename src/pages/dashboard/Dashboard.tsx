import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Package, DollarSign, TrendingUp, Calendar, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Simple event emitter for cross-component communication
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

const Dashboard = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('day'); // <- Alterado para "day"
  const [financialSummary, setFinancialSummary] = useState({
    revenue: 0,
    costs: 0,
    profit: 0,
    salesCount: 0,
    period: 'day'
  });

  const fetchFinancialSummary = useCallback(async () => {
    if (!user) return;

    let startDate = new Date();
    let endDate = new Date();

    switch (selectedPeriod) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const day = startDate.getDay();
        const diffToMonday = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(startDate.setDate(diffToMonday));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(startDate.getFullYear(), 0, 1);
        endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        break;
    }

    const { data: revenueData, error: revenueError } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'ENTRADA')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (revenueError) {
      console.error('Erro ao buscar receita:', revenueError);
      return;
    }

    const revenue = revenueData?.reduce((acc, item) => acc + parseFloat(item.amount), 0) || 0;

    const { data: costsData, error: costsError } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'SAIDA')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (costsError) {
      console.error('Erro ao buscar custos:', costsError);
      return;
    }

    const costs = costsData?.reduce((acc, item) => acc + parseFloat(item.amount), 0) || 0;

    const { data: salesData, error: salesError, count } = await supabase
      .from('sales')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .range(0, 0);

    if (salesError) {
      console.error('Erro ao buscar vendas:', salesError);
      return;
    }

    const salesCount = count || 0;

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('amount')
      .gte('date', startDate.toISOString().substring(0, 10))
      .lte('date', endDate.toISOString().substring(0, 10))
      .order('date', { ascending: false });

    if (expensesError) {
      console.error('Erro ao buscar despesas:', expensesError);
      return;
    }

    const expensesSum = expensesData?.reduce((acc, item) => acc + parseFloat(item.amount), 0) || 0;

    const profit = revenue - expensesSum;

    setFinancialSummary({
      revenue,
      costs: expensesSum,
      profit,
      salesCount,
      period: selectedPeriod
    });
  }, [selectedPeriod, user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchFinancialSummary();
  }, [fetchFinancialSummary]);

  useEffect(() => {
    const onExpenseChange = () => {
      fetchFinancialSummary();
    };
    eventEmitter.subscribe('expenseChanged', onExpenseChange);
    return () => {
      eventEmitter.unsubscribe('expenseChanged', onExpenseChange);
    };
  }, [fetchFinancialSummary]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const weekday = format(currentTime, "EEEE", { locale: ptBR });

  const [stockQuantity, setStockQuantity] = React.useState(0);
  interface Transaction {
    description: string;
    amount: string;
    created_at: string;
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
    amount?: number;
  }

  const [todaySales, setTodaySales] = React.useState<Sale[]>([]);
  const [todayExpenses, setTodayExpenses] = React.useState<Expense[]>([]);

  const fetchStockQuantity = React.useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('products').select('stock_quantity');
    if (error) {
      console.error('Erro ao buscar estoque:', error);
      return;
    }
    const totalStock = data?.reduce((acc, item) => acc + (item.stock_quantity || 0), 0) || 0;
    setStockQuantity(totalStock);
  }, [user]);

  const fetchTodaySalesAndExpenses = React.useCallback(async () => {
    if (!user) return;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*, customer:customers(name), items:sale_items(*)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('Erro ao buscar vendas do dia:', salesError);
      setTodaySales([]);
    } else {
      const sortedSales = (salesData || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTodaySales(sortedSales);
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate.toISOString().substring(0, 10))
      .lte('date', endDate.toISOString().substring(0, 10))
      .order('created_at', { ascending: false });

    if (expensesError) {
      console.error('Erro ao buscar despesas do dia:', expensesError);
      setTodayExpenses([]);
    } else {
      const sortedExpenses = (expensesData || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const todayDateStr = format(new Date(), 'yyyy-MM-dd');
      const filteredExpenses = sortedExpenses.filter(expense => {
        if (!expense.date) return false;
        const expenseDateStr = expense.date.substring(0, 10);
        return expenseDateStr === todayDateStr;
      });
      setTodayExpenses(filteredExpenses);
    }
  }, [user]);

  React.useEffect(() => {
    fetchStockQuantity();
    fetchTodaySalesAndExpenses();
  }, [fetchStockQuantity, fetchTodaySalesAndExpenses]);

  const stats = [
    {
      title: 'Faturamento',
      value: `R$ ${financialSummary.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Custos',
      value: `R$ ${financialSummary.costs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      trend: '+8%',
      trendUp: false,
    },
    {
      title: 'Lucro',
      value: `R$ ${financialSummary.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: BarChart,
      trend: '+15%',
      trendUp: true,
    },
    {
      title: 'Produtos em Estoque',
      value: stockQuantity.toString(),
      icon: Package,
      trend: '-5%',
      trendUp: false,
    },
  ];

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
                {getGreeting()}, {user?.email?.split('@')[0]}!
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
              <span className={`text-sm font-medium px-2 py-1 rounded-lg ${
                stat.trendUp ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
              }`}>
                {stat.trend}
              </span>
            </div>
            <h2 className="text-gray-500 text-sm font-medium">{stat.title}</h2>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Entradas e Saídas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Entradas</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {todaySales.map((sale) => (
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
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Saídas</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {todayExpenses.map((expense: any) => (
              <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{expense.description}</p>
                  <p className="text-sm text-gray-500">
                    Registrado por: {expense.created_by || 'Desconhecido'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(expense.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <span className="text-red-600 font-medium">
                  R$ {expense.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
export { eventEmitter };
