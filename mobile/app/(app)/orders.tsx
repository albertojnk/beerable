import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../src/services/api';

interface OrderItem {
  product_name: string;
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending_payment: { label: 'Aguardando', bg: '#f3f4f6', text: '#6b7280' },
  paid: { label: 'Pago', bg: '#fef3c7', text: '#92400e' },
  collected: { label: 'Retirado', bg: '#d1fae5', text: '#065f46' },
  cancelled: { label: 'Cancelado', bg: '#fee2e2', text: '#991b1b' },
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      api.get('/orders/my').then(({ data }) => setOrders(data)).catch(() => {});
    }, [])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const status = statusConfig[item.status] || statusConfig.pending_payment;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (item.status === 'paid') {
                  router.push({
                    pathname: '/(app)/qrcode',
                    params: { order_id: item.id },
                  });
                }
              }}
              disabled={item.status !== 'paid'}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{item.id.slice(-8)}</Text>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.text }]}>
                    {status.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemsSummary}>
                {item.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.total}>R$ {item.total.toFixed(2)}</Text>
                <Text style={styles.date}>
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              {item.status === 'paid' && (
                <Text style={styles.tapHint}>Toque para ver QR Code</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum pedido ainda</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: { fontSize: 13, fontFamily: 'monospace', color: '#6b7280' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  itemsSummary: { fontSize: 14, color: '#374151', marginBottom: 8 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: { fontSize: 16, fontWeight: '700', color: '#d97706' },
  date: { fontSize: 12, color: '#9ca3af' },
  tapHint: {
    fontSize: 12,
    color: '#d97706',
    marginTop: 8,
    fontStyle: 'italic',
  },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
});
