import { useState, useEffect, FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import api from '../services/api';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category_id: '',
  });

  const loadData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/admin/products'),
        api.get('/admin/categories'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch {
      console.error('Failed to load products');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleAvailability = async (product: Product) => {
    try {
      await api.put(`/admin/products/${product.id}`, {
        ...product,
        is_available: !product.is_available,
      });
      loadData();
    } catch {
      console.error('Failed to update product');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/products', {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        image_url: form.image_url || null,
        category_id: form.category_id || null,
      });
      setShowModal(false);
      setForm({ name: '', description: '', price: '', image_url: '', category_id: '' });
      loadData();
    } catch {
      console.error('Failed to create product');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.delete(`/admin/products/${id}`);
      loadData();
    } catch {
      console.error('Failed to delete product');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Produtos</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Novo Produto
        </button>
      </div>

      {products.length === 0 && (
        <p className="text-center text-gray-500 py-12">Nenhum produto cadastrado</p>
      )}

      <div className="grid gap-3">
        {products.map((product) => (
          <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <h3 className="font-medium text-gray-800">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-gray-500">{product.description}</p>
              )}
              <p className="text-sm font-semibold text-amber-600">
                R$ {product.price.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleAvailability(product)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  product.is_available ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    product.is_available ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <button
                onClick={() => deleteProduct(product.id)}
                className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Novo Produto</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Imagem</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Criar Produto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
