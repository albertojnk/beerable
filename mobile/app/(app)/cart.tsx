import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';
import api from '../../src/services/api';
import { useState } from 'react';

const ESTABLISHMENT_ID = '00000000-0000-0000-0000-000000000001';

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, total } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const { data } = await api.post('/orders', {
        establishment_id: ESTABLISHMENT_ID,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      });
      clearCart();
      router.push({
        pathname: '/(app)/pix-payment',
        params: {
          order_id: data.order.id,
          pix_qr_code: data.pix_qr_code,
          total: data.order.total.toString(),
        },
      });
    } catch {
      Alert.alert('Erro', 'Falha ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Seu carrinho está vazio</Text>
          <TouchableOpacity onPress={() => router.push('/(app)')}>
            <Text style={styles.link}>Ver cardápio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.product_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(item.product_id)}>
                    <Text style={styles.removeText}>Remover</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutBtn, loading && { opacity: 0.6 }]}
              onPress={handleCheckout}
              disabled={loading}
            >
              <Text style={styles.checkoutText}>
                {loading ? 'Processando...' : 'Pagar com PIX'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#9ca3af' },
  link: { color: '#d97706', marginTop: 8, fontSize: 14 },
  list: { padding: 12 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  itemPrice: { fontSize: 15, fontWeight: '700', color: '#d97706' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  qtyText: { fontSize: 16, fontWeight: '600', color: '#111827', minWidth: 20, textAlign: 'center' },
  removeText: { color: '#ef4444', fontSize: 13, marginLeft: 8 },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: { fontSize: 18, fontWeight: '600', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#d97706' },
  checkoutBtn: {
    backgroundColor: '#d97706',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
