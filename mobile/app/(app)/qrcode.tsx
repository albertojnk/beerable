import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import QRCode from 'react-native-qrcode-svg';
import api from '../../src/services/api';

export default function QRCodeScreen() {
  useKeepAwake();

  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    total: number;
    items: { product_name: string; quantity: number }[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [qrRes, orderRes] = await Promise.all([
          api.get(`/orders/${order_id}/qrcode`),
          api.get(`/orders/${order_id}`),
        ]);
        setToken(qrRes.data.token);
        setOrder({
          total: orderRes.data.total,
          items: orderRes.data.items,
        });
      } catch {
        console.error('Failed to load QR code');
      }
    };
    load();
  }, [order_id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code de Retirada</Text>

      <View style={styles.qrContainer}>
        {token ? (
          <QRCode value={token} size={260} />
        ) : (
          <Text style={styles.loading}>Carregando...</Text>
        )}
      </View>

      {order && (
        <View style={styles.orderInfo}>
          {order.items.map((item, i) => (
            <Text key={i} style={styles.itemText}>
              {item.quantity}x {item.product_name}
            </Text>
          ))}
          <Text style={styles.totalText}>Total: R$ {order.total.toFixed(2)}</Text>
        </View>
      )}

      <Text style={styles.instruction}>
        Mostre este QR Code para o atendente
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 24,
  },
  loading: {
    color: '#6b7280',
    fontSize: 16,
    width: 260,
    height: 260,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  orderInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  itemText: {
    color: '#d1d5db',
    fontSize: 15,
    marginBottom: 4,
  },
  totalText: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  instruction: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
});
