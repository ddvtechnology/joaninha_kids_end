import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function insertTestExpense() {
  const expenseData = {
    description: 'Despesa de teste',
    amount: 100.0,
    category: 'OUTROS',
    date: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('expenses')
    .insert([expenseData]);

  if (error) {
    console.error('Erro ao inserir despesa de teste:', error);
  } else {
    console.log('Despesa de teste inserida com sucesso:', data);
  }
}

insertTestExpense();
