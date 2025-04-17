import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OUTROS');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const expenseData = {
      description,
      amount: parseFloat(amount),
      category,
      date: new Date(date + 'T00:00:00').toISOString()
      // removed created_by to avoid error 400
      // created_by: 'test@example.com'
    };

    const { error } = await supabase
      .from('expenses')
      .insert([expenseData]);

    if (error) {
      setMessage('Erro ao registrar despesa: ' + error.message);
    } else {
      setMessage('Despesa registrada com sucesso!');
      setDescription('');
      setAmount('');
      setCategory('OUTROS');
      setDate(new Date().toISOString().slice(0, 10));
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Teste de Registro de Despesa</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Descrição:</label><br />
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div>
          <label>Valor:</label><br />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
            min="0"
            step="0.01"
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div>
          <label>Categoria:</label><br />
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
            <option value="FORNECEDORES">FORNECEDORES</option>
            <option value="ALUGUEL">ALUGUEL</option>
            <option value="ENERGIA">ENERGIA</option>
            <option value="ÁGUA">ÁGUA</option>
            <option value="INTERNET">INTERNET</option>
            <option value="MARKETING">MARKETING</option>
            <option value="MANUTENÇÃO">MANUTENÇÃO</option>
            <option value="SALÁRIOS">SALÁRIOS</option>
            <option value="IMPOSTOS">IMPOSTOS</option>
            <option value="OUTROS">OUTROS</option>
          </select>
        </div>
        <div>
          <label>Data:</label><br />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <button type="submit" style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Registrar Despesa
        </button>
      </form>
      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}
