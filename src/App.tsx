import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import AuthGuard from './components/AuthGuard'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { useAuth } from './hooks/useAuth'

const Carta = lazy(() => import('./pages/Carta'))
const Empresas = lazy(() => import('./pages/Empresas'))
const MenuDia = lazy(() => import('./pages/MenuDia'))
const Agotados = lazy(() => import('./pages/Agotados'))
const Bloqueados = lazy(() => import('./pages/Bloqueados'))
const AdminsNumeros = lazy(() => import('./pages/AdminsNumeros'))
const Pedidos = lazy(() => import('./pages/Pedidos'))
const ImportarCarta = lazy(() => import('./pages/ImportarCarta'))
const KdsAnalytica = lazy(() => import('./pages/KdsAnalytica'))
const Empresas = lazy(() => import('./pages/Empresas'))

function DashboardIndex() {
  const { role } = useAuth()
  if (role === 'staff') return <Navigate to="/dashboard/pedidos" replace />
  return <Dashboard />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
      Cargando...
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<DashboardIndex />} />
            <Route path="carta" element={<Suspense fallback={<PageLoader />}><Carta /></Suspense>} />
            <Route path="empresas" element={<Suspense fallback={<PageLoader />}><Empresas /></Suspense>} />
            <Route path="menu-dia" element={<Suspense fallback={<PageLoader />}><MenuDia /></Suspense>} />
            <Route path="agotados" element={<Suspense fallback={<PageLoader />}><Agotados /></Suspense>} />
            <Route path="bloqueados" element={<Suspense fallback={<PageLoader />}><Bloqueados /></Suspense>} />
            <Route path="admins" element={<Suspense fallback={<PageLoader />}><AdminsNumeros /></Suspense>} />
            <Route path="pedidos" element={<Suspense fallback={<PageLoader />}><Pedidos /></Suspense>} />
            <Route path="importar" element={<Suspense fallback={<PageLoader />}><ImportarCarta /></Suspense>} />
            <Route path="kds" element={<Suspense fallback={<PageLoader />}><KdsAnalytica /></Suspense>} />
            <Route path="empresas" element={<Suspense fallback={<PageLoader />}><Empresas /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
