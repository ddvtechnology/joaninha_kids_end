import { supabase } from './supabase';
import type { PaymentMethod } from '../types';

export interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ManagedSale {
  id: string;
  customer_id: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  points_earned: number;
  created_at: string;
  created_by: string | null;
  seller?: string | null;
  customer?: { id: string; name: string; phone?: string; total_points: number } | null;
  items: SaleItemRow[];
}

export interface EditableSaleItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

async function adjustProductStock(productId: string, delta: number) {
  const { data: product, error } = await supabase
    .from('products')
    .select('stock_quantity, name')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new Error('Produto não encontrado');
  }

  const nextStock = product.stock_quantity + delta;
  if (nextStock < 0) {
    throw new Error(`Estoque insuficiente para "${product.name}"`);
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: nextStock })
    .eq('id', productId);

  if (updateError) throw updateError;
}

/** Compensa o trigger do banco que reduz estoque ao inserir sale_items. */
async function compensateInsertTrigger(productId: string, quantity: number) {
  if (quantity <= 0) return;
  await adjustProductStock(productId, quantity);
}

function aggregateQuantities(items: { product_id: string; quantity: number }[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.product_id, (map.get(item.product_id) ?? 0) + item.quantity);
  }
  return map;
}

/** Estorna estoque, pontos e remove a venda. */
export async function revertSale(sale: ManagedSale) {
  for (const item of sale.items) {
    if (item.product_id) {
      await adjustProductStock(item.product_id, item.quantity);
    }
  }

  if (sale.customer_id && sale.points_earned > 0) {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_points')
      .eq('id', sale.customer_id)
      .single();

    if (customer) {
      const { error } = await supabase
        .from('customers')
        .update({
          total_points: Math.max(0, (customer.total_points ?? 0) - sale.points_earned),
        })
        .eq('id', sale.customer_id);
      if (error) throw error;
    }
  }

  await supabase
    .from('financial_transactions')
    .delete()
    .eq('description', `Venda #${sale.id}`);

  const { error: itemsError } = await supabase.from('sale_items').delete().eq('sale_id', sale.id);
  if (itemsError) throw itemsError;

  const { error: saleError } = await supabase.from('sales').delete().eq('id', sale.id);
  if (saleError) throw saleError;
}

export async function updateSale(
  sale: ManagedSale,
  updates: {
    customer_id: string | null;
    payment_method: PaymentMethod;
    seller: string;
    points_earned: number;
    items: EditableSaleItem[];
  }
) {
  const oldMap = aggregateQuantities(sale.items);
  const newMap = aggregateQuantities(updates.items);
  const productIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const productId of productIds) {
    const oldQty = oldMap.get(productId) ?? 0;
    const newQty = newMap.get(productId) ?? 0;
    const diff = newQty - oldQty;
    if (diff === 0) continue;
    await adjustProductStock(productId, -diff);
  }

  const existingIds = new Set(sale.items.map((i) => i.id));
  const keptIds = new Set(updates.items.filter((i) => i.id).map((i) => i.id!));

  for (const oldItem of sale.items) {
    if (!keptIds.has(oldItem.id)) {
      const { error } = await supabase.from('sale_items').delete().eq('id', oldItem.id);
      if (error) throw error;
    }
  }

  for (const item of updates.items) {
    const total_price = item.unit_price * item.quantity;
    if (item.id && existingIds.has(item.id)) {
      const { error } = await supabase
        .from('sale_items')
        .update({
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price,
          product_name: item.product_name,
        })
        .eq('id', item.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('sale_items').insert({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price,
      });
      if (error) throw error;
      await compensateInsertTrigger(item.product_id, item.quantity);
    }
  }

  const total_amount = updates.items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  );

  const { error: saleUpdateError } = await supabase
    .from('sales')
    .update({
      customer_id: updates.customer_id,
      payment_method: updates.payment_method,
      seller: updates.seller,
      points_earned: updates.points_earned,
      total_amount,
    })
    .eq('id', sale.id);

  if (saleUpdateError) throw saleUpdateError;

  const customerId = updates.customer_id;
  const customerChanged = sale.customer_id !== customerId;

  if (customerChanged) {
    if (sale.customer_id && sale.points_earned > 0) {
      const { data: oldCustomer } = await supabase
        .from('customers')
        .select('total_points')
        .eq('id', sale.customer_id)
        .single();
      if (oldCustomer) {
        await supabase
          .from('customers')
          .update({
            total_points: Math.max(0, (oldCustomer.total_points ?? 0) - sale.points_earned),
          })
          .eq('id', sale.customer_id);
      }
    }
    if (customerId && updates.points_earned > 0) {
      const { data: newCustomer } = await supabase
        .from('customers')
        .select('total_points')
        .eq('id', customerId)
        .single();
      if (newCustomer) {
        await supabase
          .from('customers')
          .update({
            total_points: (newCustomer.total_points ?? 0) + updates.points_earned,
          })
          .eq('id', customerId);
      }
    }
  } else if (customerId) {
    const pointsDiff = updates.points_earned - sale.points_earned;
    if (pointsDiff !== 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('total_points')
        .eq('id', customerId)
        .single();
      if (customer) {
        await supabase
          .from('customers')
          .update({
            total_points: Math.max(0, (customer.total_points ?? 0) + pointsDiff),
          })
          .eq('id', customerId);
      }
    }
  }

  await supabase
    .from('financial_transactions')
    .update({ amount: total_amount })
    .eq('description', `Venda #${sale.id}`);
}
