import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Sale, Expense } from '../../types';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Função para formatar data em português
const formatDateInPtBR = (date) => {
  if (!date) return '';
  
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  const dia = date.getDate().toString().padStart(2, '0');
  const mes = meses[date.getMonth()];
  const ano = date.getFullYear();
  
  return `${dia} de ${mes} de ${ano}`;
};

// Função para parse de data que lida com fusos horários corretamente
const parseDateWithoutTimezone = (dateString) => {
  if (!dateString) return new Date();
  
  // Se for uma data com horário (formato ISO)
  if (dateString.includes('T')) {
    // Extrai apenas a parte da data (YYYY-MM-DD)
    const datePart = dateString.split('T')[0];
    // Divide em ano, mês e dia
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Cria uma data na zona local, garantindo que seja o dia correto
    const localDate = new Date(year, month - 1, day, 12, 0, 0);
    return localDate;
  }
  
  // Se já for uma data simples (YYYY-MM-DD)
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Função para formatar a data ao enviar para o banco
const formatDateForDB = (date) => {
  if (!(date instanceof Date)) return date;
  
  // Usando ajuste de 12h para garantir que estamos no dia correto
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Formato YYYY-MM-DD sem componente de hora (isso evita problemas de fuso)
  return `${year}-${month}-${day}`;
};

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, paymentMethodFilter]);

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setSales([]);
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Cria cópias das datas para não modificar os estados originais
      const startDateTime = new Date(startDate.getTime());
      const endDateTime = new Date(endDate.getTime());
      
      // Configura início do dia para a data inicial
      startDateTime.setHours(0, 0, 0, 0);
      // Configura fim do dia para a data final
      endDateTime.setHours(23, 59, 59, 999);
      
      // Converte para ISO string para consulta no Supabase
      const startISO = startDateTime.toISOString();
      const endISO = endDateTime.toISOString();
      
      console.log('Consultando vendas de:', startISO, 'até:', endISO);
      console.log('Filtro de método de pagamento:', paymentMethodFilter);

      // Consulta de vendas
      let salesQuery = supabase
        .from('sales')
        .select('*, customer:customers(name), items:sale_items(*)')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false });

      if (paymentMethodFilter !== 'ALL') {
        salesQuery = salesQuery.eq('payment_method', paymentMethodFilter);
      }

      const { data: salesData, error: salesError } = await salesQuery;
      
      if (salesError) {
        console.error('Erro ao buscar vendas:', salesError);
        setErrorMessage(`Erro ao buscar vendas: ${salesError.message}`);
      }

      console.log('Vendas encontradas:', salesData?.length);

      // Consulta de despesas
      const formattedStartDate = formatDateForDB(startDate);
      const formattedEndDate = formatDateForDB(endDate);

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', formattedStartDate)
        .lte('date', formattedEndDate)
        .order('date', { ascending: false });
        
      if (expensesError) {
        console.error('Erro ao buscar despesas:', expensesError);
        setErrorMessage(`Erro ao buscar despesas: ${expensesError.message}`);
      }

      console.log('Despesas encontradas:', expensesData?.length);

      setSales(salesData || []);
      setExpenses(expensesData || []);
    } catch (error) {
      console.error('Erro inesperado:', error);
      setErrorMessage(`Erro inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
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

  // Função auxiliar para formatar datas vindas de timestamp ISO
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      console.error('Erro ao formatar timestamp:', error);
      return timestamp;
    }
  };

  // Função para traduzir método de pagamento
  const translatePaymentMethod = (method: string) => {
    const methods = {
      'PIX': 'PIX',
      'DINHEIRO': 'Dinheiro',
      'CARTAO_DEBITO': 'Cartão de Débito',
      'CARTAO_CREDITO': 'Cartão de Crédito'
    };
    return methods[method] || method;
  };

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

      {errorMessage && (
        <div className="bg-red-100 text-red-600 p-4 rounded-xl mb-6">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      ) : (
        <>
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
              <p className="text-sm text-gray-500 mt-1">
                {summary.salesCount} {summary.salesCount === 1 ? 'venda' : 'vendas'}
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
              <p className="text-sm text-gray-500 mt-1">
                {expenses.length} {expenses.length === 1 ? 'despesa' : 'despesas'}
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
                {sales.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">Nenhuma venda encontrada para este período</p>
                ) : (
                  sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          Cliente: {sale.customer?.name || 'Cliente não identificado'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sale.items && sale.items.length > 0 
                            ? `${sale.items.length} ${sale.items.length === 1 ? 'produto' : 'produtos'}: ${sale.items[0].product_name}${sale.items.length > 1 ? ` e outros` : ''}`
                            : 'Sem itens registrados'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Registrado por: {sale.created_by || 'Desconhecido'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatTimestamp(sale.created_at)}
                        </p>
                        <p className="text-sm text-gray-500 font-semibold">
                          Método: {translatePaymentMethod(sale.payment_method)}
                        </p>
                      </div>
                      <span className="text-green-600 font-medium ml-4">
                        R$ {sale.total_amount.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Saídas</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {expenses.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">Nenhuma despesa encontrada para este período</p>
                ) : (
                  expenses.map((expense: any) => (
                    <div key={expense.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{expense.description}</p>
                        <p className="text-sm text-gray-500">
                          Registrado por: {expense.created_by || 'Desconhecido'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDateInPtBR(parseDateWithoutTimezone(expense.date))}
                        </p>
                      </div>
                      <span className="text-red-600 font-medium ml-4">
                        R$ {expense.amount.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}