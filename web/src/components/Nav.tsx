import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, ScanLine, Package, LogOut } from 'lucide-react';

export default function Nav() {
  const location = useLocation();
  const navigate = useNavigate();

  const links = [
    { to: '/orders', label: 'Pedidos', icon: ClipboardList },
    { to: '/scanner', label: 'Scanner', icon: ScanLine },
    { to: '/products', label: 'Produtos', icon: Package },
  ];

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-bold text-lg text-amber-600">Beerable</span>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="ml-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
