import React, { useState } from 'react';
import { signIn, signOut } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSignIn = async () => {
    try {
      await signIn(email, password);
      setMessage('Login realizado com sucesso!');
    } catch (error: any) {
      console.error('Erro no login:', error);
      setMessage(`Erro no login: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setMessage('Logout realizado com sucesso!');
    } catch (error: any) {
      setMessage(`Erro no logout: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto', padding: 20 }}>
      <h2>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ width: '100%', marginBottom: 10, padding: 8 }}
      />
      <input
        type="password"
        placeholder="Senha"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ width: '100%', marginBottom: 10, padding: 8 }}
      />
      <button onClick={handleSignIn}>
        Entrar
      </button>
      <button onClick={handleSignOut}>
        Sair
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
