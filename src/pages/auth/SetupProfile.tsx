import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SetupProfile() {
  const [displayName, setDisplayName] = useState('');
  const { updateUserProfile } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateUserProfile(displayName);
      toast.success('Perfil atualizado com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-50">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-6">
          <div className="flex flex-col items-center mb-8">
            <div className="w-32 h-32 bg-pink-100 rounded-full mb-6 flex items-center justify-center">
              <UserCircle className="w-20 h-20 text-pink-600" />
            </div>
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
              Bem-vinda!
            </h2>
            <p className="text-gray-500 text-center">
              Por favor, nos diga seu nome para continuar
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="block w-full px-4 py-3 rounded-xl border-2 border-gray-200 shadow-sm focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
                placeholder="Digite seu nome"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors"
            >
              Continuar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}