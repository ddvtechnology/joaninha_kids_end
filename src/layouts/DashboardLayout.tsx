import React from 'react';
import { Outlet, Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Package, DollarSign, LogOut, BarChart3, Receipt, BabyIcon } from 'lucide-react';

const DashboardLayout = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-pink-100 to-purple-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin text-purple-600">
            <BabyIcon size={48} />
          </div>
          <p className="text-purple-600 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  const navigation = [
    { name: 'Início', href: '/', icon: LayoutDashboard },
    { name: 'Produtos', href: '/products', icon: Package },
    { name: 'Vendas', href: '/sales', icon: DollarSign },
    { name: 'Despesas', href: '/expenses', icon: Receipt },
    { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-72 bg-white shadow-xl">
          <div className="flex flex-col h-full">
            <div className="flex flex-col items-center p-6 border-b bg-gradient-to-r from-pink-50 to-purple-50">
              <div className="w-32 h-32 bg-gray-100 rounded-full mb-4 flex items-center justify-center border-4 border-pink-200">
                <img
                  src="/logo.jpeg"
                  alt="Logo da Joaninha Baby Kids"
                  className="w-28 h-28 rounded-full object-cover"
                />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-gray-800">Joaninha Baby Kids</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center px-4 py-3 text-gray-600 rounded-xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 hover:text-pink-600 transition-all duration-200"
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-1 border-t">
              <button
                onClick={signOut}
                className="flex items-center w-full px-4 py-3 text-gray-600 rounded-xl hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 hover:text-pink-600 transition-all duration-200"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;