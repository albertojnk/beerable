import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Camera } from 'lucide-react';
import api from '../services/api';

interface ScanResult {
  order_id: string;
  customer_name: string;
  total: number;
  items: { product_name: string; quantity: number }[];
}

type ScanState = 'scanning' | 'success' | 'error';

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [state, setState] = useState<ScanState>('scanning');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const processingRef = useRef(false);

  const startScanner = useCallback(() => {
    if (!videoRef.current || readerRef.current) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(null, videoRef.current, async (res, err) => {
      if (err || !res || processingRef.current) return;

      processingRef.current = true;
      const token = res.getText();

      try {
        const { data } = await api.post('/admin/qrcode/scan', { token });
        setState('success');
        setResult(data);
      } catch (e: unknown) {
        setState('error');
        const msg = e instanceof Error ? e.message : 'QR Code inválido';
        if (typeof e === 'object' && e !== null && 'response' in e) {
          const resp = e as { response?: { data?: { error?: string } } };
          setErrorMsg(resp.response?.data?.error || msg);
        } else {
          setErrorMsg(msg);
        }
      }

      setTimeout(() => {
        setState('scanning');
        setResult(null);
        setErrorMsg('');
        processingRef.current = false;
      }, 3000);
    });
  }, []);

  useEffect(() => {
    startScanner();
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
        readerRef.current = null;
      }
    };
  }, [startScanner]);

  const bgColor = state === 'success' ? 'bg-green-50' : state === 'error' ? 'bg-red-50' : 'bg-white';

  return (
    <div className={`rounded-xl border border-gray-200 p-6 transition-colors duration-300 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-4">
        <Camera size={20} className="text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-800">Scanner QR Code</h2>
      </div>

      <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-w-lg mx-auto mb-4">
        <video ref={videoRef} className="w-full h-full object-cover" />
      </div>

      {state === 'scanning' && (
        <p className="text-center text-gray-500 text-sm">
          Aponte a câmera para o QR Code do cliente
        </p>
      )}

      {state === 'success' && result && (
        <div className="bg-green-100 border border-green-300 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-green-800 font-semibold text-lg mb-2">Pedido confirmado!</p>
          <p className="text-green-700 text-sm mb-1">Cliente: {result.customer_name}</p>
          <ul className="text-green-700 text-sm mb-2">
            {result.items.map((item, i) => (
              <li key={i}>{item.quantity}x {item.product_name}</li>
            ))}
          </ul>
          <p className="text-green-800 font-semibold">Total: R$ {result.total.toFixed(2)}</p>
        </div>
      )}

      {state === 'error' && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-red-800 font-semibold">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
