import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Scanner from './pages/Scanner';
import Products from './pages/Products';
import PrivateRoute from './components/PrivateRoute';
import Nav from './components/Nav';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50">
                <Nav />
                <main className="max-w-5xl mx-auto p-4">
                  <Routes>
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/scanner" element={<Scanner />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="*" element={<Navigate to="/orders" />} />
                  </Routes>
                </main>
              </div>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
