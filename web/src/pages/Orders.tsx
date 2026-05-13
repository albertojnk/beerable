import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../services/api';

interface OrderItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Aguardando', color: 'bg-gray-100 text-gray-700' },
  paid: { label: 'Pago', color: 'bg-yellow-100 text-yellow-800' },
  collected: { label: 'Retirado', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/orders');
      setOrders(data);
    } catch {
      console.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Pedidos</h2>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {orders.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-12">Nenhum pedido ainda</p>
      )}

      <div className="space-y-3">
        {orders.map((order) => {
          const status = statusConfig[order.status] || statusConfig.pending_payment;
          return (
            <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-gray-500">
                  #{order.id.slice(-8)}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                {order.items.map((item, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    {item.quantity}x {item.product_name}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">
                  R$ {order.total.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
