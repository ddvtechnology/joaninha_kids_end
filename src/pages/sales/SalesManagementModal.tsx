import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Trash2, Save, RotateCcw, Eye, Pencil, Plus, Minus } from 'lucide-react';
import { format, startOfMonth, startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import type { Customer, PaymentMethod, Product } from '../../types';
import { PAYMENT_METHODS } from '../../types';
import {
  revertSale,
  updateSale,
  type ManagedSale,
  type EditableSaleItem,
} from '../../lib/saleManagement';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onChanged: () => void;
}

type View = 'list' | 'detail' | 'edit';

const SELLERS = ['Joanna Marques', 'Michelly Araújo'];

const calcPointsFromTotal = (total: number) => Math.floor(total / 10);

function fromInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Intervalo do dia no fuso local (evita vendas com data errada por UTC). */
function getLocalDateRange(from: Date, to: Date) {
  const rangeStart = startOfDay(from);
  const rangeEnd = endOfDay(to);
  return { rangeStart, rangeEnd };
}

function filterSalesByLocalDate(sales: ManagedSale[], from: Date, to: Date) {
  const { rangeStart, rangeEnd } = getLocalDateRange(from, to);
  return sales.filter((sale) => {
    if (!sale.created_at) return false;
    const saleDate = parseISO(sale.created_at);
    return isWithinInterval(saleDate, { start: rangeStart, end: rangeEnd });
  });
}

function sortSalesChronologically(sales: ManagedSale[]) {
  return [...sales].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function formatSaleDateTime(createdAt: string) {
  return format(parseISO(createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export default function SalesManagementModal({ isOpen, onClose, customers, onChanged }: Props) {
  const [sales, setSales] = useState<ManagedSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [startDateInput, setStartDateInput] = useState(() =>
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [endDateInput, setEndDateInput] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [sellerFilter, setSellerFilter] = useState('');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<ManagedSale | null>(null);
  const [editItems, setEditItems] = useState<EditableSaleItem[]>([]);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('DINHEIRO');
  const [editSeller, setEditSeller] = useState('');
  const [editPoints, setEditPoints] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const userEditedPoints = useRef(false);
  const productPickerRef = useRef<HTMLDivElement>(null);

  const fetchSales = useCallback(
    async (startStr?: string, endStr?: string) => {
      const from = fromInputDate(startStr ?? startDateInput);
      const to = fromInputDate(endStr ?? endDateInput);

      if (!from || !to) {
        toast.error('Selecione a data inicial e a data final');
        return;
      }
      if (startOfDay(from) > startOfDay(to)) {
        toast.error('A data inicial não pode ser depois da data final');
        return;
      }

      setLoading(true);
      try {
        const { rangeStart, rangeEnd } = getLocalDateRange(from, to);

        const { data, error } = await supabase
          .from('sales')
          .select('*, customer:customers(id, name, phone, total_points), items:sale_items(*)')
          .gte('created_at', rangeStart.toISOString())
          .lte('created_at', rangeEnd.toISOString())
          .order('created_at', { ascending: true })
          .limit(500);

        if (error) {
          toast.error(`Erro ao carregar vendas: ${error.message}`);
          console.error(error);
          return;
        }

        const filtered = filterSalesByLocalDate((data as ManagedSale[]) || [], from, to);
        setSales(sortSalesChronologically(filtered));
      } finally {
        setLoading(false);
      }
    },
    [startDateInput, endDateInput]
  );

  const fetchProducts = useCallback(async () => {
    // O servidor Supabase tem max_rows=1000, então paginamos para buscar tudo
    const pageSize = 1000;
    let from = 0;
    let allProducts: Product[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('[Modal] Erro ao carregar produtos:', error);
        toast.error('Erro ao carregar produtos');
        break;
      }

      if (!data || data.length === 0) break;
      allProducts = [...allProducts, ...data];
      if (data.length < pageSize) break; // última página
      from += pageSize;
    }

    const visiveis = allProducts.filter((p) => p.hidden !== true);
    setProducts(visiveis);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const defaultStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const defaultEndStr = format(new Date(), 'yyyy-MM-dd');

    fetchProducts();
    setView('list');
    setSelected(null);
    setConfirmDelete(false);
    setSearch('');
    setSellerFilter('');
    setProductSearch('');
    setShowProductPicker(false);
    setStartDateInput(defaultStartStr);
    setEndDateInput(defaultEndStr);
    fetchSales(defaultStartStr, defaultEndStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const rawEditTotal = editItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const editTotal = editDiscount > 0 ? rawEditTotal - (rawEditTotal * editDiscount) / 100 : rawEditTotal;

  useEffect(() => {
    if (view === 'edit' && !userEditedPoints.current) {
      setEditPoints(calcPointsFromTotal(editTotal));
    }
  }, [editItems, editTotal, view]);

  useEffect(() => {
    if (!showProductPicker) return;
    const handler = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setShowProductPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProductPicker]);

  const getMaxQtyForLine = (index: number): number => {
    const item = editItems[index];
    if (!item) return 0;
    const product = products.find((p) => p.id === item.product_id);
    if (!product) return item.quantity;
    // O estoque atual já foi deduzido quando a venda foi criada,
    // então devolvemos virtualmente a quantidade original da venda
    const originalQtyInSale = selected?.items?.find(
      (i) => i.product_id === item.product_id
    )?.quantity ?? 0;
    return product.stock_quantity + originalQtyInSale;
  };

  const filteredSales = sales.filter((sale) => {
    if (sellerFilter && (sale.seller ?? '') !== sellerFilter) return false;
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    const customerName = sale.customer?.name?.toLowerCase() ?? '';
    const itemsText = sale.items?.map((i) => i.product_name).join(' ').toLowerCase() ?? '';
    return (
      customerName.includes(t) ||
      itemsText.includes(t) ||
      sale.seller?.toLowerCase().includes(t) ||
      sale.id.toLowerCase().includes(t)
    );
  });

  const availableProductsToAdd = products.filter((p) => {
    // Verifica se o produto já está na lista de edição
    if (editItems.some((i) => i.product_id === p.id)) return false;

    // Estoque virtual: devolve a quantidade que já estava na venda original
    // pois aquela quantidade foi deduzida do banco quando a venda foi feita
    const originalQtyInSale = selected?.items?.find(
      (i) => i.product_id === p.id
    )?.quantity ?? 0;
    const effectiveStock = p.stock_quantity + originalQtyInSale;

    if (effectiveStock <= 0) return false;

    const term = productSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.reference ?? '').toLowerCase().includes(term) ||
      (p.brand ?? '').toLowerCase().includes(term) ||
      (p.size ?? '').toLowerCase().includes(term)
    );
  });

  const openDetail = (sale: ManagedSale) => {
    setSelected(sale);
    setView('detail');
    setConfirmDelete(false);
  };

  const openEdit = async (sale: ManagedSale) => {
    await fetchProducts();
    setSelected(sale);
    setEditItems(
      sale.items.map((i) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      }))
    );
    setEditCustomerId(sale.customer_id ?? '');
    setEditPayment(sale.payment_method);
    setEditSeller(sale.seller ?? '');
    setEditPoints(sale.points_earned ?? 0);
    
    // Calculate original discount percentage
    const rawTotal = sale.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const discountPercent = rawTotal > 0 ? ((rawTotal - sale.total_amount) / rawTotal) * 100 : 0;
    setEditDiscount(Math.round(discountPercent));

    userEditedPoints.current = false;
    setProductSearch('');
    setShowProductPicker(false);
    setView('edit');
    setConfirmDelete(false);
  };

  const handleRevert = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await revertSale(selected);
      toast.success('Venda estornada com sucesso');
      onChanged();
      setView('list');
      setSelected(null);
      fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao estornar venda';
      toast.error(msg);
      console.error(err);
    } finally {
      setProcessing(false);
      setConfirmDelete(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    if (editItems.length === 0) {
      toast.error('A venda precisa ter pelo menos um produto');
      return;
    }
    if (!editSeller) {
      toast.error('Selecione a vendedora');
      return;
    }

    for (let i = 0; i < editItems.length; i++) {
      const max = getMaxQtyForLine(i);
      if (editItems[i].quantity > max) {
        toast.error(`Estoque insuficiente para "${editItems[i].product_name}"`);
        return;
      }
    }

    const rawTotal = editItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const finalTotal = editDiscount > 0 ? rawTotal - (rawTotal * editDiscount) / 100 : rawTotal;

    setProcessing(true);
    try {
      await updateSale(selected, {
        customer_id: editCustomerId || null,
        payment_method: editPayment,
        seller: editSeller,
        points_earned: editPoints,
        total_amount: finalTotal,
        items: editItems,
      });
      toast.success('Venda atualizada');
      onChanged();
      setView('list');
      setSelected(null);
      fetchSales();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar venda';
      toast.error(msg);
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const updateEditQty = (index: number, delta: number) => {
    const max = getMaxQtyForLine(index);
    setEditItems((items) =>
      items
        .map((item, i) => {
          if (i !== index) return item;
          const q = item.quantity + delta;
          if (q < 1) return null;
          if (q > max) {
            toast.error(`Estoque máximo: ${max} un.`);
            return item;
          }
          return { ...item, quantity: q };
        })
        .filter(Boolean) as EditableSaleItem[]
    );
  };

  const removeEditItem = (index: number) => {
    setEditItems((items) => items.filter((_, i) => i !== index));
  };

  const addProductToEdit = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast.error('Produto sem estoque disponível');
      return;
    }
    if (editItems.some((i) => i.product_id === product.id)) {
      toast.error('Produto já está na venda');
      return;
    }
    setEditItems([
      ...editItems,
      {
        product_id: product.id,
        product_name: product.size ? `${product.name} - ${product.size}` : product.name,
        quantity: 1,
        unit_price: product.sale_price,
      },
    ]);
    setProductSearch('');
    setShowProductPicker(false);
    userEditedPoints.current = false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 md:p-6 border-b flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Gerenciar Vendas</h2>
            <p className="text-sm text-gray-500">
              {view === 'list' && 'Consultar, editar ou estornar vendas'}
              {view === 'detail' && 'Detalhes da venda'}
              {view === 'edit' && 'Editar venda'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (view === 'list') onClose();
              else {
                setView('list');
                setSelected(null);
              }
            }}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'list' && (
          <>
            <div className="p-4 border-b space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar cliente, produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-200"
                />
              </div>

              <p className="text-sm font-medium text-gray-700">Período</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data inicial</label>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data final</label>
                  <input
                    type="date"
                    value={endDateInput}
                    min={startDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-200"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-gray-500 mb-1 block">Vendedora</label>
                  <select
                    value={sellerFilter}
                    onChange={(e) => setSellerFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-200"
                  >
                    <option value="">Todas</option>
                    {SELLERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => fetchSales()}
                  disabled={loading}
                  className="px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 text-sm disabled:opacity-50 shrink-0"
                >
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {loading ? (
                <p className="text-center text-gray-500 py-8">Carregando...</p>
              ) : filteredSales.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma venda encontrada</p>
              ) : (
                <div className="space-y-2">
                  {filteredSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">
                          {sale.customer?.name || 'Sem cliente'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatSaleDateTime(sale.created_at)}
                          {sale.seller ? ` · ${sale.seller}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {sale.items?.length ?? 0} item(ns) ·{' '}
                          {PAYMENT_METHODS.find((m) => m.value === sale.payment_method)?.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-green-600">
                          R$ {sale.total_amount.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openDetail(sale)}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(sale)}
                          className="p-2 rounded-lg text-pink-600 hover:bg-pink-50"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'detail' && selected && (
          <div className="overflow-y-auto flex-1 p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Cliente</p>
                <p className="font-medium">{selected.customer?.name || 'Sem cliente'}</p>
              </div>
              <div>
                <p className="text-gray-500">Vendedora</p>
                <p className="font-medium">{selected.seller || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Pagamento</p>
                <p className="font-medium">
                  {PAYMENT_METHODS.find((m) => m.value === selected.payment_method)?.label}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Pontos</p>
                <p className="font-medium">{selected.points_earned ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500">Data</p>
                <p className="font-medium">
                  {format(parseISO(selected.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Registrado por</p>
                <p className="font-medium">{selected.created_by || '-'}</p>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Produto</th>
                    <th className="text-center p-3">Qtd</th>
                    <th className="text-right p-3">Unit.</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3">{item.product_name}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">R$ {item.unit_price.toFixed(2)}</td>
                      <td className="p-3 text-right font-medium">
                        R$ {item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-green-600">
                R$ {selected.total_amount.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => openEdit(selected)}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 text-sm"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Estornar venda
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <span className="text-sm text-red-600">
                    Confirma estorno? Estoque e pontos serão revertidos.
                  </span>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleRevert}
                    className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 border rounded-xl text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'edit' && selected && (
          <div className="overflow-y-auto flex-1 p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Cliente</label>
                <select
                  value={editCustomerId}
                  onChange={(e) => setEditCustomerId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                >
                  <option value="">Sem cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Vendedora</label>
                <select
                  value={editSeller}
                  onChange={(e) => setEditSeller(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  required
                >
                  <option value="">Selecione</option>
                  {SELLERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Pagamento</label>
                <select
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value as PaymentMethod)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">
                  Pontos{' '}
                  <span className="text-xs text-gray-400">(R$10 = 1 pt, atualiza ao mudar itens)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={editPoints}
                  onChange={(e) => {
                    userEditedPoints.current = true;
                    setEditPoints(Number(e.target.value));
                  }}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Desconto (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-200"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Produtos</p>
              <div className="space-y-2 mb-3">
                {editItems.map((item, index) => {
                  const maxQty = getMaxQtyForLine(index);
                  return (
                    <div
                      key={item.id ?? `new-${item.product_id}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">
                          R$ {item.unit_price.toFixed(2)} · Total: R${' '}
                          {(item.unit_price * item.quantity).toFixed(2)}
                          {' · '}máx. {maxQty} un.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateEditQty(index, -1)}
                          className="p-1 rounded bg-white border"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateEditQty(index, 1)}
                          disabled={item.quantity >= maxQty}
                          className="p-1 rounded bg-white border disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEditItem(index)}
                          className="p-1 rounded bg-red-50 text-red-600 ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative" ref={productPickerRef}>
                <label className="text-sm text-gray-600 mb-1 block">Adicionar produto (com estoque)</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, ref., marca ou tamanho..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductPicker(true);
                    }}
                    onFocus={() => setShowProductPicker(true)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-200"
                  />
                </div>
                {showProductPicker && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {availableProductsToAdd.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500 text-center">
                        {productSearch.trim()
                          ? 'Nenhum produto com estoque encontrado'
                          : 'Digite para buscar produtos disponíveis'}
                      </p>
                    ) : (
                      availableProductsToAdd.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProductToEdit(p)}
                          className="w-full text-left px-3 py-2 hover:bg-pink-50 text-sm border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium">
                            {p.name}
                            {p.size ? ` - ${p.size}` : ''}
                          </span>
                          <span className="text-gray-500 ml-2">
                            R$ {p.sale_price.toFixed(2)} · est: {p.stock_quantity}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center border-t pt-3">
              <span className="font-semibold">Novo total</span>
              <span className="text-lg font-bold text-green-600">R$ {editTotal.toFixed(2)}</span>
            </div>

            <p className="text-xs text-gray-500">
              Só é possível incluir produtos com estoque maior que zero. Pontos recalculam automaticamente
              ao alterar itens (1 ponto a cada R$ 10).
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={processing}
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar alterações
              </button>
              <button
                type="button"
                onClick={() => setView('detail')}
                className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
