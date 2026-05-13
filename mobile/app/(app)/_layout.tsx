import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#d97706',
        tabBarInactiveTintColor: '#9ca3af',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '600', color: '#111827' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cardápio',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🍺</Text>,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Carrinho',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🛒</Text>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="pix-payment"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="qrcode"
        options={{ href: null }}
      />
    </Tabs>
  );
}
