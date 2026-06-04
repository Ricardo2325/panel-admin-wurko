import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../hooks/useAuth'

interface Props {
  allowed: UserRole[]
  redirectTo: string
  children: React.ReactNode
}

export default function RoleGuard({ allowed, redirectTo, children }: Props) {
  const { role, loading } = useAuth()

  if (loading) return null

  if (!allowed.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
