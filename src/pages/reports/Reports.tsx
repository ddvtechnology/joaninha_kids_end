import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, ArrowDown, ArrowUp, FileDown, PieChart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Sale, Expense } from '../../types';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [brandSalesData, setBrandSalesData] = useState<{brand: string, amount: number, percentage: number}[]>([]);
  const [showBrandStats, setShowBrandStats] = useState(false);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, paymentMethodFilter]);

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setSales([]);
      setExpenses([]);
      setBrandSalesData([]);
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
        .select('*, customer:customers(name), items:sale_items(*, product:products(*))')
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

      // Buscar contas pagas (bills) dentro do período para incluir no relatório
      const { data: paidBillsData, error: paidBillsError } = await supabase
        .from('bills')
        .select('*')
        .eq('status', 'PAGO')
        .gte('payment_date', formattedStartDate)
        .lte('payment_date', formattedEndDate)
        .order('payment_date', { ascending: false });

      if (paidBillsError) {
        console.error('Erro ao buscar contas pagas:', paidBillsError);
        setErrorMessage(`Erro ao buscar contas pagas: ${paidBillsError.message}`);
      }

      console.log('Despesas encontradas:', expensesData?.length);
      console.log('Contas pagas encontradas:', paidBillsData?.length);

      // Filtrar contas pagas que já possuem despesa vinculada
      const billsWithNoExpense = (paidBillsData || []).filter(bill => {
        return !(expensesData || []).some(expense => expense.bill_id === bill.id);
      });

      // Mapear contas pagas restantes para formato de despesa para unificar exibição
      const mappedPaidBills = billsWithNoExpense.map(bill => ({
        id: bill.id,
        description: bill.description,
        amount: bill.amount,
        category: bill.category,
        date: bill.payment_date,
        created_by: bill.created_by,
        isBill: true  // flag para identificar que é uma conta paga
      }));

      // Unir despesas e contas pagas filtradas
      const combinedExpenses = [...(expensesData || []), ...mappedPaidBills];

      setSales(salesData || []);
      setExpenses(combinedExpenses);
      
      // Processar dados de vendas por marca
      if (salesData && salesData.length > 0) {
        calculateBrandPercentages(salesData);
      } else {
        setBrandSalesData([]);
      }
    } catch (error) {
      console.error('Erro inesperado:', error);
      setErrorMessage(`Erro inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

const calculateBrandPercentages = (salesData) => {
    // Mapear todas as marcas e seus valores de venda
    const brandMap: { [key: string]: number } = {};
    let totalSaleAmount = 0;
    
    // Correção: garantir que estamos acessando corretamente os itens e produtos
    salesData.forEach(sale => {
      if (sale.items && Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach(item => {
          if (item && item.product) {
            const brand = item.product.brand || 'Sem marca';
            const amount = (item.unit_price * item.quantity) || 0;
            
            if (!brandMap[brand]) {
              brandMap[brand] = 0;
            }
            
            brandMap[brand] += amount;
            totalSaleAmount += amount;
          }
        });
      }
    });
    
    // Calcular percentagens
    const brandStats = Object.keys(brandMap).map(brand => ({
      brand,
      amount: brandMap[brand],
      percentage: totalSaleAmount > 0 ? (brandMap[brand] / totalSaleAmount) * 100 : 0
    }));
    
    // Ordenar por valor de vendas (decrescente)
    brandStats.sort((a, b) => b.amount - a.amount);
    
    setBrandSalesData(brandStats);
  };

  const calculateSummary = () => {
    const expensesSum = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const revenueFromSales = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const revenue = revenueFromSales;
    return {
      revenue,
      expenses: expensesSum,
      profit: revenue - expensesSum,
      salesCount: sales.length
      // Removido: averageTicket
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

  // Exportar para Excel
  const exportToExcel = () => {
    // Criar planilha
    const wb = utils.book_new();
    
    // Dados do resumo
    const summaryData = [
      ['Período', `${formatDateInPtBR(startDate)} a ${formatDateInPtBR(endDate)}`],
      ['Faturamento', `R$ ${summary.revenue.toFixed(2)}`],
      ['Despesas', `R$ ${summary.expenses.toFixed(2)}`],
      ['Lucro', `R$ ${summary.profit.toFixed(2)}`],
      ['Número de Vendas', summary.salesCount]
      // Removido: Ticket Médio
    ];
    
    const summarySheet = utils.aoa_to_sheet(summaryData);
    utils.book_append_sheet(wb, summarySheet, 'Resumo');
    
    // Dados de vendas
    const salesData = [
      ['Cliente', 'Produtos', 'Método de Pagamento', 'Data', 'Registrado por', 'Valor']
    ];
    
    sales.forEach(sale => {
      salesData.push([
        sale.customer?.name || 'Cliente não identificado',
        sale.items && sale.items.length > 0 
          ? `${sale.items.length} produto(s): ${sale.items[0].product_name}${sale.items.length > 1 ? ' e outros' : ''}`
          : 'Sem itens registrados',
        translatePaymentMethod(sale.payment_method),
        formatTimestamp(sale.created_at),
        sale.created_by || 'Desconhecido',
        `R$ ${sale.total_amount.toFixed(2)}`
      ]);
    });
    
    const salesSheet = utils.aoa_to_sheet(salesData);
    
    // Ajustar largura das colunas para o conteúdo
    const salesColWidths = [
      { wch: 30 }, // Cliente
      { wch: 40 }, // Produtos
      { wch: 20 }, // Método de Pagamento
      { wch: 30 }, // Data
      { wch: 20 }, // Registrado por
      { wch: 15 }  // Valor
    ];
    salesSheet['!cols'] = salesColWidths;
    
    utils.book_append_sheet(wb, salesSheet, 'Vendas');
    
    // Dados de despesas
    const expensesData = [
      ['Descrição', 'Data', 'Registrado por', 'Valor']
    ];
    
    expenses.forEach(expense => {
      expensesData.push([
        expense.description,
        formatDateInPtBR(parseDateWithoutTimezone(expense.date)),
        expense.created_by || 'Desconhecido',
        `R$ ${expense.amount.toFixed(2)}`
      ]);
    });
    
    const expensesSheet = utils.aoa_to_sheet(expensesData);
    
    // Ajustar largura das colunas para o conteúdo
    const expensesColWidths = [
      { wch: 40 }, // Descrição
      { wch: 30 }, // Data
      { wch: 20 }, // Registrado por
      { wch: 15 }  // Valor
    ];
    expensesSheet['!cols'] = expensesColWidths;
    
    utils.book_append_sheet(wb, expensesSheet, 'Despesas');
    
    // Dados de vendas por marca
    const brandData = [
      ['Marca', 'Valor Total', 'Percentagem']
    ];
    
    brandSalesData.forEach(item => {
      brandData.push([
        item.brand,
        `R$ ${item.amount.toFixed(2)}`,
        `${item.percentage.toFixed(2)}%`
      ]);
    });
    
    const brandSheet = utils.aoa_to_sheet(brandData);
    
    // Ajustar largura das colunas para o conteúdo
    const brandColWidths = [
      { wch: 30 }, // Marca
      { wch: 15 }, // Valor Total
      { wch: 15 }  // Percentagem
    ];
    brandSheet['!cols'] = brandColWidths;
    
    utils.book_append_sheet(wb, brandSheet, 'Vendas por Marca');
    
    // Gerar arquivo e download
    const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Formato do nome: relatorio_dd-mm-yyyy_a_dd-mm-yyyy.xlsx
    const startDateFormatted = format(startDate, 'dd-MM-yyyy');
    const endDateFormatted = format(endDate, 'dd-MM-yyyy');
    saveAs(data, `relatorio_${startDateFormatted}_a_${endDateFormatted}.xlsx`);
  };

  // Exportar para PDF
  const exportToPDF = () => {
    try {
      // Aumentando o tamanho da página para comportar mais conteúdo
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
    
      // Título
      doc.setFontSize(18);
      doc.text('Relatório Financeiro', 105, 15, { align: 'center' });
    
      // Período
      doc.setFontSize(12);
      doc.text(`Período: ${formatDateInPtBR(startDate)} a ${formatDateInPtBR(endDate)}`, 105, 25, { align: 'center' });
    
      // Resumo
      doc.setFontSize(14);
      doc.text('Resumo', 14, 35);
    
      // Garantir que autotable está disponível
      let currentY = 40;
      autoTable(doc, {
        startY: currentY,
        head: [['Métrica', 'Valor']],
        body: [
          ['Faturamento', `R$ ${summary.revenue.toFixed(2)}`],
          ['Despesas', `R$ ${summary.expenses.toFixed(2)}`],
          ['Lucro', `R$ ${summary.profit.toFixed(2)}`],
          ['Número de Vendas', summary.salesCount.toString()]
          // Removido: Ticket Médio
        ],
        theme: 'striped',
        headStyles: { fillColor: [233, 30, 99] }
      });
      currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : currentY + 40;
    
      doc.setFontSize(14);
      doc.text('Vendas por Marca', 14, currentY);
    
      if (brandSalesData.length > 0) {
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Marca', 'Valor Total', 'Percentagem']],
          body: brandSalesData.map(item => [
            item.brand,
            `R$ ${item.amount.toFixed(2)}`,
            `${item.percentage.toFixed(2)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [233, 30, 99] }
        });
        currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : currentY + 40;
      } else {
        doc.setFontSize(12);
        doc.text('Nenhum dado de marca disponível', 105, currentY + 10, { align: 'center' });
        currentY += 40;
      }
    
      // Novas páginas para vendas e despesas
      doc.addPage();
      currentY = 15;
    
      // Vendas
      doc.setFontSize(14);
      doc.text('Vendas', 14, currentY);
    
      if (sales.length > 0) {
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Cliente', 'Método de Pagamento', 'Data', 'Valor']],
          body: sales.map(sale => [
            sale.customer?.name || 'Cliente não identificado',
            translatePaymentMethod(sale.payment_method),
            formatTimestamp(sale.created_at),
            `R$ ${sale.total_amount.toFixed(2)}`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [233, 30, 99] }
        });
      } else {
        doc.setFontSize(12);
        doc.text('Nenhuma venda no período selecionado', 105, currentY + 10, { align: 'center' });
      }
    
      // Despesas
      doc.addPage();
      currentY = 15;
      doc.setFontSize(14);
      doc.text('Despesas', 14, currentY);
    
      if (expenses.length > 0) {
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Descrição', 'Data', 'Valor']],
          body: expenses.map(expense => [
            expense.description,
            formatDateInPtBR(parseDateWithoutTimezone(expense.date)),
            `R$ ${expense.amount.toFixed(2)}`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [233, 30, 99] }
        });
      } else {
        doc.setFontSize(12);
        doc.text('Nenhuma despesa no período selecionado', 105, currentY + 10, { align: 'center' });
      }
    
      // Formato do nome: relatorio_dd-mm-yyyy_a_dd-mm-yyyy.pdf
      const startDateFormatted = format(startDate, 'dd-MM-yyyy');
      const endDateFormatted = format(endDate, 'dd-MM-yyyy');
      doc.save(`relatorio_${startDateFormatted}_a_${endDateFormatted}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setErrorMessage(`Erro ao gerar PDF: ${error.message}. Verifique o console para mais detalhes.`);
    }
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

      {/* Botões de exportação */}
      <div className="flex justify-end gap-4 mb-6">
        <button 
          onClick={exportToPDF} 
          disabled={loading || sales.length === 0} 
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileDown className="w-5 h-5" />
          Exportar PDF
        </button>
        <button 
          onClick={exportToExcel} 
          disabled={loading || sales.length === 0} 
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileDown className="w-5 h-5" />
          Exportar Excel
        </button>
      </div>

      {/* Botão para mostrar/esconder estatísticas por marca */}
      <button
        onClick={() => setShowBrandStats(!showBrandStats)}
        className="flex items-center gap-2 px-4 py-2 mb-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
      >
        <PieChart className="w-5 h-5" />
        {showBrandStats ? 'Esconder Estatísticas por Marca' : 'Mostrar Estatísticas por Marca'}
      </button>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

          {/* Estatísticas de vendas por marca */}
          {showBrandStats && (
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Vendas por Marca</h2>
              
              {brandSalesData.length === 0 ? (
                <p className="text-center text-gray-500 py-6">Nenhum dado de marca disponível para este período</p>
              ) : (
                <div className="space-y-4">
                  {brandSalesData.map((item, index) => (
                    <div key={index} className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold inline-block text-gray-900">
                            {item.brand}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold inline-block text-gray-900">
                            {item.percentage.toFixed(2)}%
                          </span>
                          <span className="text-sm ml-2 text-gray-600">
                            (R$ {item.amount.toFixed(2)})
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                        <div 
                          style={{ width: `${item.percentage}%` }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-pink-500"
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Entradas</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {sales.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">Nenhuma venda encontrada para este período</p>
                ) : (
                  sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50"><div className="flex-1">
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