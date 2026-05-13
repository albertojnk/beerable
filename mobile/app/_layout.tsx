import { Slot } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { CartProvider } from '../src/contexts/CartContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <Slot />
      </CartProvider>
    </AuthProvider>
  );
}
