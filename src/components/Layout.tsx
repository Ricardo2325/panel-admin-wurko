import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../hooks/useAuth'

interface NavItem {
  to: string
  label: string
}

const allNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Inicio' },
  { to: '/dashboard/empresas', label: 'Empresas' },
  { to: '/dashboard/carta', label: 'Carta de productos' },
  { to: '/dashboard/menu-dia', label: 'Menú del día' },
  { to: '/dashboard/agotados', label: 'Productos agotados' },
  { to: '/dashboard/bloqueados', label: 'Números bloqueados' },
  { to: '/dashboard/admins', label: 'Números admin' },
  { to: '/dashboard/pedidos', label: 'Pedidos' },
  { to: '/dashboard/importar', label: 'Importar carta' },
  { to: '/dashboard/kds', label: 'Analítica KDS' },
  { to: '/dashboard/empresas', label: 'Empresas' },
]

const navByRole: Record<UserRole, NavItem[]> = {
  dev: allNavItems,
  jefe: [
    { to: '/dashboard', label: 'Inicio' },
    { to: '/dashboard/empresas', label: 'Empresas' },
    { to: '/dashboard/pedidos', label: 'Pedidos' },
    { to: '/dashboard/carta', label: 'Carta de productos' },
    { to: '/dashboard/importar', label: 'Importar carta' },
    { to: '/dashboard/kds', label: 'Analítica KDS' },
    { to: '/dashboard/empresas', label: 'Empresas' },
  ],
  staff: [
    { to: '/dashboard/pedidos', label: 'Pedidos' },
    { to: '/dashboard/bloqueados', label: 'Números bloqueados' },
    { to: '/dashboard/agotados', label: 'Productos agotados' },
    { to: '/dashboard/menu-dia', label: 'Menú del día' },
  ],
}

const roleLabels: Record<UserRole, string> = {
  dev: 'Developer',
  jefe: 'Jefe',
  staff: 'Staff',
}

const roleBadgeColors: Record<UserRole, string> = {
  dev: 'bg-violet-500/20 text-violet-300',
  jefe: 'bg-amber-500/20 text-amber-300',
  staff: 'bg-emerald-500/20 text-emerald-300',
}

async function handleLogout() {
  await supabase.auth.signOut()
}

export default function Layout() {
  const { user, role } = useAuth()
  const navItems = navByRole[role]

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wurko Padel</p>
          <p className="text-sm text-white mt-0.5">Panel Admin</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700 space-y-2">
          {user && (
            <div className="px-1">
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
              <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${roleBadgeColors[role]}`}>
                {roleLabels[role]}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
