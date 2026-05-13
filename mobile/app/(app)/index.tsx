import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import api from '../../src/services/api';
import { useCart } from '../../src/contexts/CartContext';

const ESTABLISHMENT_ID = '00000000-0000-0000-0000-000000000001';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const { data } = await api.get(`/establishment/${ESTABLISHMENT_ID}/menu`);
      setCategories(data.categories || []);
      setProducts(data.products || []);
    } catch {
      console.error('Failed to load menu');
    }
  };

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

  return (
    <View style={styles.container}>
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {itemCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{itemCount} item(ns) no carrinho</Text>
        </View>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            {item.image_url && (
              <Image source={{ uri: item.image_url }} style={styles.productImage} />
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              {item.description && (
                <Text style={styles.productDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.productPrice}>R$ {item.price.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addItem(item)}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum produto disponível</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  categoryBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 52,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#d97706',
  },
  categoryText: { fontSize: 14, color: '#6b7280' },
  categoryTextActive: { color: '#fff', fontWeight: '600' },
  cartBadge: {
    backgroundColor: '#fef3c7',
    padding: 8,
    alignItems: 'center',
  },
  cartBadgeText: { color: '#92400e', fontSize: 13, fontWeight: '500' },
  list: { padding: 12 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  productDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  productPrice: { fontSize: 15, fontWeight: '700', color: '#d97706', marginTop: 4 },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
});
