import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Search, Trash2, X, Edit2, Calendar, Bell, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, differenceInDays, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

// Interface de despesa
interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
}

// Nova interface para contas a pagar
interface Bill {
  id: string;
  description: string;
  amount: number;
  category: string;
  due_date: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  created_at: string;
  payment_date?: string;
  notify_days_before: number;
}

// Categorias de despesas
const EXPENSE_CATEGORIES = [
  'FORNECEDORES',
  'ALUGUEL',
  'ENERGIA',
  'ÁGUA',
  'INTERNET',
  'MARKETING',
  'MANUTENÇÃO',
  'SALÁRIOS',
  'IMPOSTOS',
  'OUTROS'
];

// Status das contas
const BILL_STATUS = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  PAGO: { label: 'Pago', color: 'bg-green-100 text-green-800' },
  ATRASADO: { label: 'Atrasado', color: 'bg-red-100 text-red-800' }
};

// Opções de notificação
const NOTIFICATION_OPTIONS = [
  { value: 1, label: '1 dia antes' },
  { value: 2, label: '2 dias antes' },
  { value: 3, label: '3 dias antes' },
  { value: 5, label: '5 dias antes' },
  { value: 7, label: '7 dias antes' },
  { value: 14, label: '14 dias antes' },
  { value: 30, label: '30 dias antes' }
];

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
    const localDate = new Date(year, month - 1, day, 0, 0, 0);
    return localDate;
  }

  // Se já for uma data simples (YYYY-MM-DD)
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0);
};

// Função para formatar a data ao enviar para o banco
const formatDateForDB = (date) => {
  if (!(date instanceof Date)) return date;

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  // Formato YYYY-MM-DD sem componente de hora (isso evita problemas de fuso)
  return `${year}-${month}-${day}`;
};

// CORREÇÃO 1: Função melhorada para calcular dias entre datas
const calculateDaysBetween = (startDate, endDate) => {
  // Garantir que estamos trabalhando com datas sem componente de hora
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  // Converter para milissegundos e calcular diferença em dias
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

// Função para verificar se uma conta está próxima do vencimento
const isDueSoon = (dueDate, notifyDaysBefore) => {
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reseta o horário para comparação apenas por data

  const dueDateObj = parseDateWithoutTimezone(dueDate);
  // CORREÇÃO: Usando nossa função melhorada
  const daysUntilDue = calculateDaysBetween(today, dueDateObj);
  return daysUntilDue <= notifyDaysBefore && daysUntilDue >= 0;
};

// Função para verificar se uma conta está atrasada
const isOverdue = (dueDate) => {
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reseta o horário

  const dueDateObj = parseDateWithoutTimezone(dueDate);
  return dueDateObj < today;
};

export default function BillsAndExpensesManager() {
  const today = new Date();
  const { user } = useAuth();

  // Estados para despesas
  const [expenses, setExpenses] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    description: '',
    amount: '',
    category: 'OUTROS',
    date: today
  });
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [currentExpenseId, setCurrentExpenseId] = useState(null);

  // Estados para contas a pagar
  const [bills, setBills] = useState([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billFormData, setBillFormData] = useState({
    description: '',
    amount: '',
    category: 'OUTROS',
    due_date: today,
    notify_days_before: 3,
    status: 'PENDENTE',
    payment_date: null
  });
  const [isEditingBill, setIsEditingBill] = useState(false);
  const [currentBillId, setCurrentBillId] = useState(null);

  // Estados compartilhados
  const [activeTab, setActiveTab] = useState('expenses');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Carregar dados ao inicializar o componente
  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchExpenses();
    } else {
      fetchBills();
    }
  }, [activeTab]);

  // CORREÇÃO 2: Função para atualizar notificações com base nas contas atuais
  const updateNotifications = (currentBills) => {
    if (!currentBills || currentBills.length === 0) {
      setNotifications([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reseta o horário para comparação apenas por data

    // Filtrar contas que estão próximas do vencimento para notificações
    const upcomingBills = currentBills.filter(bill =>
      bill.status === 'PENDENTE' && isDueSoon(bill.due_date, bill.notify_days_before)
    );

    // Preparar notificações
    const newNotifications = upcomingBills.map(bill => {
      const dueDateObj = parseDateWithoutTimezone(bill.due_date);
      return {
        id: bill.id,
        description: bill.description,
        due_date: bill.due_date,
        amount: bill.amount,
        // CORREÇÃO: Usando nossa função melhorada
        days_remaining: calculateDaysBetween(today, dueDateObj)
      };
    });

    setNotifications(newNotifications);
  };

  // Verificar contas próximas do vencimento e atualizar status
  useEffect(() => {
    if (bills.length > 0) {
      // CORREÇÃO: Usar nossa função atualizada de notificações
      updateNotifications(bills);

      // Atualizar status de contas atrasadas
      const overdueIds = bills
        .filter(bill => bill.status === 'PENDENTE' && isOverdue(bill.due_date))
        .map(bill => bill.id);

      if (overdueIds.length > 0) {
        updateOverdueBills(overdueIds);
      }
    }
  }, [bills]);

  // Função para buscar despesas do banco de dados
  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        toast.error('Erro ao carregar despesas');
        console.error('Erro ao carregar despesas:', error);
        return;
      }

      setExpenses(data || []);
    } catch (err) {
      console.error('Erro na requisição:', err);
      toast.error('Falha na conexão com o banco de dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para buscar contas a pagar do banco de dados
  const fetchBills = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) {
        toast.error('Erro ao carregar contas a pagar');
        console.error('Erro ao carregar contas:', error);
        return;
      }

      setBills(data || []);
      // CORREÇÃO: Atualizar notificações aqui também garante que estão sempre sincronizadas
      updateNotifications(data || []);
    } catch (err) {
      console.error('Erro na requisição:', err);
      toast.error('Falha na conexão com o banco de dados');
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar status de contas atrasadas
  const updateOverdueBills = async (ids) => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ status: 'ATRASADO' })
        .in('id', ids);

      if (error) {
        console.error('Erro ao atualizar contas atrasadas:', error);
        return;
      }

      // Atualizar localmente
      setBills(prev => prev.map(bill =>
        ids.includes(bill.id) ? { ...bill, status: 'ATRASADO' } : bill
      ));
    } catch (err) {
      console.error('Erro na operação:', err);
    }
  };

  // Handlers para formulário de despesas
  const handleExpenseInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'date') return; // data tratada separadamente
    setExpenseFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleExpenseDateChange = (e) => {
    const selectedDate = new Date(e.target.value + 'T12:00:00');
    setExpenseFormData(prev => ({ ...prev, date: selectedDate }));
  };

  const resetExpenseForm = () => {
    setExpenseFormData({
      description: '',
      amount: '',
      category: 'OUTROS',
      date: today
    });
    setIsEditingExpense(false);
    setCurrentExpenseId(null);
  };

  const handleEditExpense = (expense) => {
    setExpenseFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: parseDateWithoutTimezone(expense.date)
    });

    setIsEditingExpense(true);
    setCurrentExpenseId(expense.id);
    setShowExpenseModal(true);
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();

    const expenseData = {
      description: expenseFormData.description,
      amount: parseFloat(expenseFormData.amount) || 0,
      category: expenseFormData.category,
      date: formatDateForDB(expenseFormData.date),
      created_by: user?.email || 'anonymous'
    };

    try {
      if (isEditingExpense) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', currentExpenseId);

        if (updateError) {
          toast.error('Erro ao atualizar despesa');
          console.error('Erro ao atualizar despesa:', updateError);
          return;
        }

        toast.success('Despesa atualizada com sucesso');
      } else {
        const { data: newExpense, error: expenseError } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select();

        if (expenseError) {
          toast.error('Erro ao registrar despesa');
          console.error('Erro ao registrar despesa:', expenseError);
          return;
        }

        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert([{
            type: 'SAIDA',
            description: expenseFormData.description,
            amount: parseFloat(expenseFormData.amount) || 0,
            category: expenseFormData.category,
            created_by: user?.email || 'anonymous'
          }]);

        if (transactionError) {
          toast.error('Erro ao registrar transação financeira');
          console.error('Erro ao registrar transação:', transactionError);
          return;
        }

        toast.success('Despesa registrada com sucesso');
      }

      setShowExpenseModal(false);
      resetExpenseForm();
      fetchExpenses();
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) {
        toast.error('Erro ao excluir despesa');
        console.error('Erro ao excluir despesa:', error);
        return;
      }

      toast.success('Despesa excluída com sucesso');
      fetchExpenses();
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  // Handlers para formulário de contas a pagar
  const handleBillInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'due_date' || name === 'payment_date') return; // datas tratadas separadamente
    setBillFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBillDateChange = (e) => {
    const { name, value } = e.target;
    const selectedDate = value ? new Date(value + 'T12:00:00') : null;
    setBillFormData(prev => ({ ...prev, [name]: selectedDate }));
  };

  const resetBillForm = () => {
    setBillFormData({
      description: '',
      amount: '',
      category: 'OUTROS',
      due_date: today,
      notify_days_before: 3,
      status: 'PENDENTE',
      payment_date: null
    });
    setIsEditingBill(false);
    setCurrentBillId(null);
  };

  const handleEditBill = (bill) => {
    setBillFormData({
      description: bill.description,
      amount: bill.amount.toString(),
      category: bill.category,
      due_date: parseDateWithoutTimezone(bill.due_date),
      notify_days_before: bill.notify_days_before,
      status: bill.status,
      payment_date: bill.payment_date ? parseDateWithoutTimezone(bill.payment_date) : null
    });

    setIsEditingBill(true);
    setCurrentBillId(bill.id);
    setShowBillModal(true);
  };

  const handleMarkAsPaid = async (bill) => {
    const today = new Date();

    try {
      const { error } = await supabase
        .from('bills')
        .update({
          status: 'PAGO',
          payment_date: formatDateForDB(today)
        })
        .eq('id', bill.id);

      if (error) {
        toast.error('Erro ao marcar conta como paga');
        console.error('Erro ao atualizar status:', error);
        return;
      }

      // Registrar como despesa
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert([{
          description: bill.description,
          amount: bill.amount,
          category: bill.category,
          date: formatDateForDB(today),
          created_by: user?.email || 'anonymous',
          // Adicionar o ID da conta original para rastreamento
          bill_id: bill.id  // Novo campo para rastreamento
        }]);

      if (expenseError) {
        toast.error('Erro ao registrar despesa');
        console.error('Erro ao registrar despesa:', expenseError);
      }

      // Registrar transação financeira
      const { error: transactionError } = await supabase
        .from('financial_transactions')
        .insert([{
          type: 'SAIDA',
          description: bill.description,
          amount: bill.amount,
          category: bill.category,
          created_by: user?.email || 'anonymous'
        }]);

      if (transactionError) {
        toast.error('Erro ao registrar transação financeira');
        console.error('Erro ao registrar transação:', transactionError);
      }

      toast.success('Conta marcada como paga');

      // CORREÇÃO: Atualizar apenas a conta no estado local antes de fazer nova busca
      const updatedBills = bills.map(b => {
        if (b.id === bill.id) {
          return {
            ...b,
            status: 'PAGO',
            payment_date: formatDateForDB(today)
          };
        }
        return b;
      });

      setBills(updatedBills);
      // CORREÇÃO: Atualizar notificações após mudança de status
      updateNotifications(updatedBills);

      // Ainda fazemos o fetch para garantir consistência com o banco
      fetchBills();
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  const handleSubmitBill = async (e) => {
    e.preventDefault();

    const billData = {
      description: billFormData.description,
      amount: parseFloat(billFormData.amount) || 0,
      category: billFormData.category,
      due_date: formatDateForDB(billFormData.due_date),
      notify_days_before: parseInt(billFormData.notify_days_before),
      status: billFormData.status,
      payment_date: billFormData.payment_date ? formatDateForDB(billFormData.payment_date) : null,
      created_by: user?.email || 'anonymous'
    };

    try {
      if (isEditingBill) {
        const { error } = await supabase
          .from('bills')
          .update(billData)
          .eq('id', currentBillId);

        if (error) {
          toast.error('Erro ao atualizar conta');
          console.error('Erro ao atualizar conta:', error);
          return;
        }

        toast.success('Conta atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('bills')
          .insert([billData]);

        if (error) {
          toast.error('Erro ao registrar conta');
          console.error('Erro ao registrar conta:', error);
          return;
        }

        toast.success('Conta registrada com sucesso');
      }

      setShowBillModal(false);
      resetBillForm();
      fetchBills();
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  const handleDeleteBill = async (billId) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
  
    try {
      // Primeiro, verifique se há uma despesa relacionada a esta conta
      const { data: relatedExpense, error: findError } = await supabase
        .from('expenses')
        .select('id')
        .eq('bill_id', billId);
  
      if (findError) {
        console.error('Erro ao procurar despesas relacionadas:', findError);
      }
  
      // Se encontrou despesas relacionadas, exclua-as
      if (relatedExpense && relatedExpense.length > 0) {
        const expenseIds = relatedExpense.map(expense => expense.id);
        
        const { error: expenseDeleteError } = await supabase
          .from('expenses')
          .delete()
          .in('id', expenseIds);
  
        if (expenseDeleteError) {
          toast.error('Erro ao excluir despesa relacionada');
          console.error('Erro ao excluir despesa relacionada:', expenseDeleteError);
        }
      }
  
      // Agora exclua a conta
      const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId);
  
      if (error) {
        toast.error('Erro ao excluir conta');
        console.error('Erro ao excluir conta:', error);
        return;
      }
  
      toast.success('Conta excluída com sucesso');
      
      // CORREÇÃO: Atualizar o estado local antes de fazer o fetch
      const updatedBills = bills.filter(bill => bill.id !== billId);
      setBills(updatedBills);
      
      // CORREÇÃO: Remover a notificação relacionada à conta excluída
      setNotifications(prev => prev.filter(notification => notification.id !== billId));
      
      // Ainda fazemos o fetch para garantir consistência com o banco
      fetchBills();
      // Atualize também as despesas para refletir as mudanças
      fetchExpenses();
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  // Filtragem de dados
  const filteredExpenses = expenses.filter(expense =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBills = bills.filter(bill =>
    bill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bill.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 rounded-xl">
      {/* Notificações */}
      {notifications.length > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-medium text-orange-800">
              Contas próximas do vencimento ({notifications.length})
            </h2>
          </div>
          <div className="space-y-2">
            {notifications.map(notification => (
              <div key={notification.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="font-medium">{notification.description}</p>
                    <p className="text-sm text-gray-600">
                      Vence em {notification.days_remaining} dia{notification.days_remaining !== 1 ? 's' : ''}: {formatDateInPtBR(parseDateWithoutTimezone(notification.due_date))}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">R$ {notification.amount.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas principais */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'expenses'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                <span>Despesas</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'bills'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>Contas a Pagar</span>
              </div>
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'expenses') {
              resetExpenseForm();
              setShowExpenseModal(true);
            } else {
              resetBillForm();
              setShowBillModal(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {activeTab === 'expenses' ? 'Nova Despesa' : 'Nova Conta'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder={activeTab === 'expenses' ? "Buscar despesas..." : "Buscar contas..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Carregando dados...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Painel de Despesas */}
              {activeTab === 'expenses' && (
                <>
                  {filteredExpenses.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Nenhuma despesa encontrada</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-4 px-4 font-semibold text-gray-600">Data</th>
                          <th className="text-left py-4 px-4 font-semibold text-gray-600">Descrição</th>
                          <th className="text-left py-4 px-4 font-semibold text-gray-600">Categoria</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-600">Valor</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-600">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-4 px-4">
                              {formatDateInPtBR(parseDateWithoutTimezone(expense.date))}
                            </td>
                            <td className="py-4 px-4">{expense.description}</td>
                            <td className="py-4 px-4">{expense.category}</td>
                            <td className="py-4 px-4 text-right text-red-600">
                              R$ {expense.amount.toFixed(2)}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditExpense(expense)}
                                  className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                                  title="Editar despesa"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExpense(expense.id)}
                                  className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                                  title="Excluir despesa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Painel de Contas a Pagar */}
              {activeTab === 'bills' && (
                <>
                  {filteredBills.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Nenhuma conta encontrada</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-4 px-4 font-semibold text-gray-600">Vencimento</th>
                          <th className="text-left py-4 px-4 font-semibold text-gray-600">Descrição</th>
                          <th className="text-left py-4 px-4 font-semibold text-gray-600">Categoria</th>
                          <th className="text-center py-4 px-4 font-semibold text-gray-600">Status</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-600">Valor</th>
                          <th className="text-right py-4 px-4 font-semibold text-gray-600">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBills.map((bill) => (
                          <tr key={bill.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-4 px-4">
                              {formatDateInPtBR(parseDateWithoutTimezone(bill.due_date))}
                            </td>
                            <td className="py-4 px-4">{bill.description}</td>
                            <td className="py-4 px-4">{bill.category}</td>
                            <td className="py-4 px-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BILL_STATUS[bill.status].color}`}>
                              {BILL_STATUS[bill.status].label}
                            </span>
                            </td>
                            <td className="py-4 px-4 text-right text-red-600">
                              R$ {bill.amount.toFixed(2)}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-end gap-2">
                                {bill.status === 'PENDENTE' && (
                                  <button
                                    onClick={() => handleMarkAsPaid(bill)}
                                    className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"
                                    title="Marcar como pago"
                                  >
                                    <span className="block w-4 h-4">✓</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleEditBill(bill)}
                                  className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                                  title="Editar conta"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBill(bill.id)}
                                  className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                                  title="Excluir conta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Despesa */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditingExpense ? 'Editar Despesa' : 'Nova Despesa'}
              </h2>
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  resetExpenseForm();
                }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={expenseFormData.description}
                    onChange={handleExpenseInputChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    name="category"
                    value={expenseFormData.category}
                    onChange={handleExpenseInputChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  >
                    {EXPENSE_CATEGORIES.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formatDateForDB(expenseFormData.date)}
                    onChange={handleExpenseDateChange}
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={expenseFormData.amount}
                    onChange={handleExpenseInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    resetExpenseForm();
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
                >
                  {isEditingExpense ? 'Salvar Alterações' : 'Registrar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Conta a Pagar */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditingBill ? 'Editar Conta' : 'Nova Conta a Pagar'}
              </h2>
              <button
                onClick={() => {
                  setShowBillModal(false);
                  resetBillForm();
                }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBill} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={billFormData.description}
                    onChange={handleBillInputChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    name="category"
                    value={billFormData.category}
                    onChange={handleBillInputChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  >
                    {EXPENSE_CATEGORIES.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={formatDateForDB(billFormData.due_date)}
                    onChange={handleBillDateChange}
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notificar antes
                  </label>
                  <select
                    name="notify_days_before"
                    value={billFormData.notify_days_before}
                    onChange={handleBillInputChange}
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  >
                    {NOTIFICATION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={billFormData.amount}
                    onChange={handleBillInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                  />
                </div>

                {isEditingBill && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={billFormData.status}
                      onChange={handleBillInputChange}
                      required
                      className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                    >
                      {Object.keys(BILL_STATUS).map(status => (
                        <option key={status} value={status}>
                          {BILL_STATUS[status].label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(isEditingBill && billFormData.status === 'PAGO') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Pagamento
                    </label>
                    <input
                      type="date"
                      name="payment_date"
                      value={billFormData.payment_date ? formatDateForDB(billFormData.payment_date) : ''}
                      onChange={handleBillDateChange}
                      className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBillModal(false);
                    resetBillForm();
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
                >
                  {isEditingBill ? 'Salvar Alterações' : 'Registrar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}