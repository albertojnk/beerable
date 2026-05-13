import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import api from '../../src/services/api';

export default function PixPayment() {
  const { order_id, pix_qr_code, total } = useLocalSearchParams<{
    order_id: string;
    pix_qr_code: string;
    total: string;
  }>();
  const router = useRouter();
  const [status, setStatus] = useState('pending_payment');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/orders/${order_id}`);
        if (data.status === 'paid') {
          setStatus('paid');
          clearInterval(intervalRef.current);
          clearInterval(timerRef.current);
          router.replace({
            pathname: '/(app)/qrcode',
            params: { order_id },
          });
        }
      } catch {
        // keep polling
      }
    }, 3000);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= 600) {
          clearInterval(intervalRef.current);
          clearInterval(timerRef.current);
          Alert.alert('Expirado', 'O tempo para pagamento expirou');
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(timerRef.current);
    };
  }, [order_id]);

  const remaining = Math.max(600 - elapsed, 0);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  if (status === 'paid') {
    return (
      <View style={[styles.container, { backgroundColor: '#d1fae5' }]}>
        <Text style={styles.paidText}>Pagamento confirmado!</Text>
        <Text style={styles.paidSub}>Redirecionando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagamento PIX</Text>
      <Text style={styles.amount}>R$ {parseFloat(total || '0').toFixed(2)}</Text>

      <View style={styles.qrContainer}>
        {pix_qr_code ? (
          <QRCode value={pix_qr_code} size={220} />
        ) : (
          <Text>Carregando QR Code...</Text>
        )}
      </View>

      <Text style={styles.instruction}>
        Abra seu aplicativo do banco e escaneie o QR Code acima para pagar
      </Text>

      <Text style={styles.timer}>
        Expira em {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>

      <Text style={styles.waiting}>Aguardando pagamento...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 24,
  },
  instruction: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  waiting: {
    fontSize: 14,
    color: '#9ca3af',
  },
  paidText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#065f46',
  },
  paidSub: {
    fontSize: 14,
    color: '#047857',
    marginTop: 8,
  },
});
