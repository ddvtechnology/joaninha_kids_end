import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Search, Edit2, AlertCircle, X, Package, Ruler } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Product, ProductCategory } from '../../types';
import { PRODUCT_CATEGORIES } from '../../types';
import toast from 'react-hot-toast';

const MAX_PRODUCTS_LOAD = 5000;

function escapeIlike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export default function StockControl() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [summaryGender, setSummaryGender] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState<string>('');

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('hidden', false)
        .gt('stock_quantity', 0) // Regra aplicada para TODA a página
        .order('name');

      query = query.limit(MAX_PRODUCTS_LOAD);

      const { data, error } = await query;

      if (error) {
        toast.error('Erro ao carregar estoque');
        return;
      }

      setProducts(data || []);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Extract unique sizes from all products to create the filter dropdown
  const uniqueSizes = useMemo(() => {
    const sizes = products.map(p => p.size?.toUpperCase().trim()).filter(Boolean);
    return Array.from(new Set(sizes)).sort();
  }, [products]);

  // Aggregations for summary panels (Category x Size)
  const stockMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    products.forEach(p => {
      // Considera apenas produtos que realmente têm estoque > 0
      if (!p.stock_quantity || p.stock_quantity <= 0) return;

      // Filtro específico do painel de resumo
      if (summaryGender && p.gender !== summaryGender) return;

      const cat = p.category.replace(/_/g, ' ');
      const size = p.size?.toUpperCase().trim() || 'Sem Tamanho';
      const qty = p.stock_quantity; // Soma a quantidade física de estoque
      
      if (!matrix[cat]) matrix[cat] = {};
      matrix[cat][size] = (matrix[cat][size] || 0) + qty;
      matrix[cat]['TOTAL'] = (matrix[cat]['TOTAL'] || 0) + qty;
    });
    return matrix;
  }, [products, summaryGender]);

  // Apply local filtering since we already loaded the data
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchSearch = searchTerm === '' || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchCategory = selectedCategory === '' || product.category === selectedCategory;
      const matchSize = selectedSize === '' || product.size?.toUpperCase().trim() === selectedSize;
      const matchGender = selectedGender === '' || product.gender === selectedGender;

      return matchSearch && matchCategory && matchSize && matchGender;
    });
  }, [products, searchTerm, selectedCategory, selectedSize, selectedGender]);

  const handleEditStock = (product: Product) => {
    setEditingProduct(product);
    setNewStock(product.stock_quantity?.toString() || '0');
    setShowModal(true);
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updatedQuantity = parseInt(newStock) || 0;

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: updatedQuantity })
      .eq('id', editingProduct.id);

    if (error) {
      toast.error('Erro ao atualizar estoque');
      return;
    }

    toast.success('Estoque atualizado com sucesso');
    setShowModal(false);
    setEditingProduct(null);
    fetchProducts();
  };

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-pink-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Controle de Estoque</h1>
        </div>
      </div>

      {/* Resumo de Estoque */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-pink-600" />
            Resumo de Estoque por Categoria e Tamanho
          </h2>
          <select
            value={summaryGender}
            onChange={(e) => setSummaryGender(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors text-sm bg-white"
          >
            <option value="">Todos os Sexos</option>
            <option value="UNISSEX">Unissex</option>
            <option value="FEMININO">Feminino</option>
            <option value="MASCULINO">Masculino</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(stockMatrix)
            .sort((a, b) => b[1].TOTAL - a[1].TOTAL)
            .map(([category, sizes]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex justify-between items-center border-b pb-2 mb-2">
                <h3 className="font-semibold text-gray-800">{category}</h3>
                <span className="text-sm font-bold text-pink-600">{sizes.TOTAL} un. total</span>
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {Object.entries(sizes)
                  .filter(([s]) => s !== 'TOTAL')
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([size, qty]) => (
                  <div key={size} className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">{size}</span>
                    <span className="font-semibold text-gray-900">{qty} un.</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(stockMatrix).length === 0 && (
            <div className="text-gray-500 text-sm">Nenhum produto cadastrado no estoque ainda.</div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            <div className="flex-1 relative w-full">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, marca ou referência..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
              />
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
              >
                <option value="">Todas as Categorias</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
              >
                <option value="">Todos os Tamanhos</option>
                {uniqueSizes.map((size) => (
                  <option key={size} value={size}>
                    Tamanho: {size}
                  </option>
                ))}
              </select>

              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 transition-colors"
              >
                <option value="">Todos os Sexos</option>
                <option value="UNISSEX">Unissex</option>
                <option value="FEMININO">Feminino</option>
                <option value="MASCULINO">Masculino</option>
              </select>
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div className="overflow-x-auto">
            {loadingProducts ? (
              <div className="py-12 text-center text-gray-500">Carregando estoque...</div>
            ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-4 font-semibold text-gray-600 rounded-tl-lg">Produto</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-600">Categoria</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-600">Sexo</th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-600">Tamanho</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-600">Status</th>
                  <th className="text-right py-4 px-4 font-semibold text-gray-600">Qtd. Estoque</th>
                  <th className="text-right py-4 px-4 font-semibold text-gray-600 rounded-tr-lg">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const stock = product.stock_quantity ?? 0;
                  const isLowStock = stock <= (product.min_stock ?? 5);

                  return (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-pink-50 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">Ref: {product.reference || '-'} | {product.brand || 'Sem marca'}</p>
                      </td>
                      <td className="py-4 px-4 text-gray-700">{product.category}</td>
                      <td className="py-4 px-4 text-gray-700">{product.gender || 'UNISSEX'}</td>
                      <td className="py-4 px-4 font-medium text-gray-800">{product.size || '-'}</td>
                      <td className="py-4 px-4 text-center">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3" />
                            Baixo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`text-lg font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleEditStock(product)}
                          className="p-2 rounded-lg bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors inline-flex items-center justify-center"
                          title="Ajustar Estoque"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      Nenhum produto encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edição Rápida de Estoque */}
      {showModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Ajustar Estoque
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  Produto: <span className="font-medium text-gray-900">{editingProduct.name}</span>
                  <br />
                  Tamanho: <span className="font-medium text-gray-900">{editingProduct.size || 'N/A'}</span>
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Quantidade em Estoque</label>
                <input
                  type="number"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  required
                  min="0"
                  className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:ring focus:ring-pink-200 focus:ring-opacity-50 text-lg font-semibold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700"
                >
                  Salvar Estoque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
