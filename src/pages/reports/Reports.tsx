import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Sale, Expense } from '../../types';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, paymentMethodFilter]);

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setSales([]);
      setExpenses([]);
      return;
    }

    setLoading(true);

    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setHours(23, 59, 59, 999);

    const adjustedStartDate = new Date(startDate);
    adjustedStartDate.setHours(0, 0, 0, 0);

    let salesQuery = supabase
      .from('sales')
      .select('*, customer:customers(name), items:sale_items(*)')
      .gte('created_at', adjustedStartDate.toISOString())
      .lte('created_at', adjustedEndDate.toISOString())
      .order('created_at', { ascending: false }); // <-- ORDEM DECRESCENTE

    if (paymentMethodFilter !== 'ALL') {
      salesQuery = salesQuery.eq('payment_method', paymentMethodFilter);
    }

    const { data: salesData } = await salesQuery;

    // Filtragem de despesas, garantindo que a data está sendo aplicada corretamente
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', adjustedStartDate.toISOString()) // Filter for start date
      .lte('date', adjustedEndDate.toISOString()) // Filter for end datex
      .order('date', { ascending: false }); // <-- ORDEM DECRESCENTE

    setSales(salesData || []);
    setExpenses(expensesData || []);
    setLoading(false);
  };

  const calculateSummary = () => {
    const expensesSum = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const revenueFromSales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const revenue = revenueFromSales;
    return {
      revenue,
      expenses: expensesSum,
      profit: revenue - expensesSum,
      salesCount: sales.length,
      averageTicket: sales.length > 0 ? revenueFromSales / sales.length : 0
    };
  };

  const summary = calculateSummary();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-pink-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
        </div>
        <div className="flex gap-4 items-center">
          <DatePicker
            selected={startDate || undefined}
            onChange={(date: Date | null) => setStartDate(date)}
            selectsStart
            startDate={startDate || undefined}
            endDate={endDate || undefined}
            dateFormat="dd/MM/yyyy"
            locale={ptBR}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
            placeholderText="Data Início"
            calendarStartDay={1}
          />
          <DatePicker
            selected={endDate || undefined}
            onChange={(date: Date | null) => setEndDate(date)}
            selectsEnd
            startDate={startDate || undefined}
            endDate={endDate || undefined}
            minDate={startDate || undefined}
            dateFormat="dd/MM/yyyy"
            locale={ptBR}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
            placeholderText="Data Fim"
            calendarStartDay={1}
          />
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
          >
            <option value="ALL">Todos os Métodos</option>
            <option value="PIX">PIX</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO_DEBITO">Cartão Débito</option>
            <option value="CARTAO_CREDITO">Cartão Crédito</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-xl">
              <ArrowUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Faturamento</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            R$ {summary.revenue.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 rounded-xl">
              <ArrowDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Despesas</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            R$ {summary.expenses.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Lucro</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            R$ {summary.profit.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Entradas</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">
                    Cliente: {sale.customer?.name || 'Cliente não identificado'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Produto: {sale.items && sale.items.length > 0 ? sale.items[0].product_name : 'Produto não identificado'}
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
                  R$ {sale.total_amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Saídas</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {expenses.map((expense: any) => (
              <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{expense.description}</p>
                  <p className="text-sm text-gray-500">
                    Registrado por: {expense.created_by || 'Desconhecido'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(expense.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
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
}
