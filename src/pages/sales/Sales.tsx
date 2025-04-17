import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Search, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product, Customer, CartItem, PaymentMethod } from '../../types';
import { PAYMENT_METHODS } from '../../types';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function Sales() {
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [pointsInput, setPointsInput] = useState<number | ''>('');
  const userEditedPoints = useRef(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  useEffect(() => {
    const total = calculateTotal();
    const calculatedPoints = Math.floor(total / 10);
    if (!userEditedPoints.current) {
      setPointsInput(calculatedPoints);
    }
  }, [cart]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('hidden', true) // <-- só pega produtos ativos
      .order('name');

    if (error) {
      toast.error('Erro ao carregar produtos');
      return;
    }

    setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Erro ao carregar clientes');
      return;
    }

    setCustomers(data);
  };

  const addToCart = (product: Product) => {
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.id === product.id);

      if (existingItem) {
        if (existingItem.quantity < product.stock_quantity) {
          return currentCart.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          toast.error('Estoque insuficiente');
          return currentCart;
        }
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });
  };


  const updateQuantity = (productId: string, change: number) => {
    setCart(currentCart =>
      currentCart.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantity + change;
          if (newQuantity <= 0) return null;
          if (newQuantity > item.stock_quantity) {
            toast.error('Estoque insuficiente');
            return item;
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };


  const removeFromCart = (productId: string) => {
    setCart(currentCart => currentCart.filter(item => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.sale_price * item.quantity), 0);
  };

  const calculatePoints = () => {
    return pointsInput === '' ? 0 : pointsInput;
  };

  const handleCreateCustomer = async () => {
    const { data, error } = await supabase
      .from('customers')
      .insert([newCustomer])
      .select()
      .single();

    if (error) {
      toast.error('Erro ao cadastrar cliente');
      return;
    }

    toast.success('Cliente cadastrado com sucesso!');
    setCustomers([...customers, data]);
    setSelectedCustomer(data);
    setShowNewCustomerForm(false);
    setNewCustomer({ name: '', phone: '' });
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }

    const total = calculateTotal();
    const points = calculatePoints();

    const sale = {
      customer_id: selectedCustomer?.id,
      total_amount: total,
      payment_method: paymentMethod,
      points_earned: points,
      created_by: user?.email ?? null,
    };

    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([sale])
        .select()
        .single();

      if (saleError) {
        toast.error(`Erro ao registrar venda: ${saleError.message}`);
        console.error('Sale insert error:', saleError);
        return;
      }

      if (!saleData || !saleData.id) {
        toast.error('Erro inesperado: dados da venda inválidos');
        console.error('Sale data invalid:', saleData);
        return;
      }

      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.sale_price,
        total_price: item.sale_price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) {
        toast.error(`Erro ao registrar itens da venda: ${itemsError.message}`);
        console.error('Sale items insert error:', itemsError);
        return;
      }

      toast.success('Venda registrada com sucesso!');
      setCart([]);
      setSelectedCustomer(null);
      setPaymentMethod('DINHEIRO');
      setPointsInput('');
      userEditedPoints.current = false;
    } catch (error) {
      toast.error('Erro inesperado ao registrar venda');
      console.error('Unexpected error in handleFinalizeSale:', error);
    }
  };

  const handlePointsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    userEditedPoints.current = true;
    const value = e.target.value;
    setPointsInput(value === '' ? '' : Number(value));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lista de Produtos */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Produtos</h2>
          <div className="relative flex-1 max-w-xs ml-4">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
            />
          </div>
        </div>

        <div className="space-y-4">
          {products
            .filter(product =>
              product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.category.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map(product => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-pink-100 hover:bg-pink-50 transition-colors"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">
                    {product.category} - Estoque: {product.stock_quantity}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-medium text-gray-900">
                    R$ {product.sale_price.toFixed(2)}
                  </p>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stock_quantity === 0}
                    className="p-2 rounded-lg bg-pink-100 text-pink-600 hover:bg-pink-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Carrinho */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-pink-600" />
            <h2 className="text-xl font-semibold text-gray-900">Carrinho</h2>
          </div>
          <span className="text-sm text-gray-500">
            {cart.length} {cart.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {/* Cliente */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Cliente</h3>
          {showNewCustomerForm ? (
            <div className="space-y-4 mb-4">
              <input
                type="text"
                placeholder="Nome do cliente"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
              />
              <input
                type="text"
                placeholder="Telefone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateCustomer}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
                >
                  Cadastrar
                </button>
                <button
                  onClick={() => setShowNewCustomerForm(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  setSelectedCustomer(customer || null);
                }}
                className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
              >
                <option value="">Selecione um cliente</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.total_points} pontos
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewCustomerForm(true)}
                className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
              >
                Novo
              </button>
            </div>
          )}
        </div>

        {/* Itens do Carrinho */}
        <div className="space-y-4 mb-6">
          {cart.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-xl bg-gray-50"
            >
              <div>
                <h3 className="font-medium text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">
                  R$ {item.sale_price.toFixed(2)} x {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-medium text-gray-900">
                  R$ {(item.sale_price * item.quantity).toFixed(2)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="p-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Forma de Pagamento */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</h3>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50"
          >
            {PAYMENT_METHODS.map(method => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        {/* Total e Finalização */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">R$ {calculateTotal().toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-6">
            <label htmlFor="pointsInput" className="text-gray-600">Pontos a ganhar:</label>
            <input
              id="pointsInput"
              type="number"
              min={0}
              value={pointsInput}
              onChange={handlePointsInputChange}
              className="w-20 px-2 py-1 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 text-center font-medium text-green-600"
            />
          </div>
          <button
            onClick={handleFinalizeSale}
            disabled={cart.length === 0}
            className="w-full py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <DollarSign className="w-5 h-5" />
            Finalizar Venda
          </button>
        </div>
      </div>
    </div>
  );
}
