import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Search, Trash2, X, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
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

// CORREÇÃO PRINCIPAL: Nova função para parse de data que lida com fusos horários corretamente
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
// CORREÇÃO: Garantir que a data no banco seja sempre a data correta sem ajustes de fuso horário
const formatDateForDB = (date) => {
  if (!(date instanceof Date)) return date;
  
  // Usando ajuste de 12h para garantir que estamos no dia correto
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Formato YYYY-MM-DD sem componente de hora (isso evita problemas de fuso)
  return `${year}-${month}-${day}`;
};

export default function ExpensesDemo() {
  const today = new Date();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'OUTROS',
    date: today
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentExpenseId, setCurrentExpenseId] = useState(null);

  // Carregar despesas ao inicializar o componente
  useEffect(() => {
    fetchExpenses();
  }, []);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'date') return; // data tratada separadamente
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e) => {
    // Ao receber uma data do input date, garantimos que ela seja interpretada corretamente
    const selectedDate = new Date(e.target.value + 'T12:00:00'); // Meio-dia para evitar problemas de fuso
    setFormData(prev => ({ ...prev, date: selectedDate }));
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'OUTROS',
      date: today
    });
    setIsEditing(false);
    setCurrentExpenseId(null);
  };

  const handleEdit = (expense) => {
    // Preenche o formulário com os dados da despesa selecionada
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: parseDateWithoutTimezone(expense.date)
    });
    
    // Define o modo de edição e armazena o ID da despesa atual
    setIsEditing(true);
    setCurrentExpenseId(expense.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Preparar dados para o banco
    const expenseData = {
      description: formData.description,
      amount: parseFloat(formData.amount) || 0,
      category: formData.category,
      date: formatDateForDB(formData.date),
      created_by: user?.email || 'anonymous'
    };
    
    try {
      if (isEditing) {
        // Atualizar despesa existente
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
        // Registrar nova despesa
        const { data: newExpense, error: expenseError } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select();

        if (expenseError) {
          toast.error('Erro ao registrar despesa');
          console.error('Erro ao registrar despesa:', expenseError);
          return;
        }

        // Registrar transação financeira apenas para novas despesas
        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert([{
            type: 'SAIDA',
            description: formData.description,
            amount: parseFloat(formData.amount) || 0,
            category: formData.category,
            created_by: user?.email || 'anonymous'
          }]);

        if (transactionError) {
          toast.error('Erro ao registrar transação financeira');
          console.error('Erro ao registrar transação:', transactionError);
          return;
        }

        toast.success('Despesa registrada com sucesso');
      }
      
      setShowModal(false);
      resetForm();
      fetchExpenses(); // Recarregar despesas atualizadas
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  const handleDelete = async (expenseId) => {
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
      fetchExpenses(); // Recarregar despesas atualizadas
    } catch (err) {
      console.error('Erro na operação:', err);
      toast.error('Erro ao processar sua solicitação');
    }
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Receipt className="w-8 h-8 text-pink-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Despesas</h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Despesa
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar despesas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Carregando despesas...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                              onClick={() => handleEdit(expense)}
                              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                              title="Editar despesa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id)}
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
            </div>
          )}
        </div>
      </div>

      {/* Modal de Despesa */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Editar Despesa' : 'Nova Despesa'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
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
                    value={formData.category}
                    onChange={handleInputChange}
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
                    value={formatDateForDB(formData.date)}
                    onChange={handleDateChange}
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
                    value={formData.amount}
                    onChange={handleInputChange}
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
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
                >
                  {isEditing ? 'Salvar Alterações' : 'Registrar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}