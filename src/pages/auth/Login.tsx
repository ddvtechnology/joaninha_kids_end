import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BabyIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso!');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('E-mail ou senha incorretos');
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-3 pb-6">
          <div className="flex flex-col items-center mb-2">
            <div className="w-32 h-32 bg-gray-100 rounded-full mb-4 flex items-center justify-center border-4 border-pink-200">
            <img
                  src="./public/logo.jpeg"
                  alt="Logo da Joaninha Baby Kids"
                  className="w-28 h-28 rounded-full object-cover"
                />
            </div>
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
              Joaninha Baby Kids
            </h2>
            <p className="text-gray-500 text-center">Sistema de Gerenciamento</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 rounded-xl border-2 border-gray-200 shadow-sm focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
                placeholder="seu@email.com.br"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 rounded-xl border-2 border-gray-200 shadow-sm focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <BabyIcon className="animate-spin h-5 w-5 mr-2" />
                  Entrando...
                </div>
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>
        </div>
        <div className="px-8 py-4 bg-gradient-to-r from-pink-50 to-purple-50 border-t border-gray-100">
          <p className="text-xs text-center text-gray-500">
            © {new Date().getFullYear()} DDV TECHNOLOGY. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}