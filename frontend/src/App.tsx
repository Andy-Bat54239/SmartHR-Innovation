import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireRole } from './auth/RequireRole'
import { Layout } from './components/Layout'
import { useAuth } from './hooks/useAuth'
import ChangePasswordPage from './pages/auth/ChangePasswordPage'
import GoogleCallbackPage from './pages/auth/GoogleCallbackPage'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import DepartmentsPage from './pages/departments/DepartmentsPage'
import EmployeesPage from './pages/employees/EmployeesPage'
import LeavesPage from './pages/leaves/LeavesPage'
import LocationsPage from './pages/locations/LocationsPage'
import MyLeavePage from './pages/me/MyLeavePage'
import MyProfilePage from './pages/me/MyProfilePage'
import SecurityPage from './pages/security/SecurityPage'
import MyTrainingsPage from './pages/me/MyTrainingsPage'
import TrainingDetailPage from './pages/trainings/TrainingDetailPage'
import TrainingsPage from './pages/trainings/TrainingsPage'
import UsersPage from './pages/users/UsersPage'
import AuditPage from './pages/audit/AuditPage'

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
        Back to the start
      </Link>
    </div>
  )
}

/** HR and administrators start on the dashboard; an employee starts on their own profile. */
function Home() {
  const { hasRole } = useAuth()
  return hasRole('HR', 'ADMIN') ? <DashboardPage /> : <Navigate to="/me" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="auth/google/callback" element={<GoogleCallbackPage />} />

      {/* everything below needs a login */}
      <Route element={<RequireAuth />}>
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />

          {/* any signed-in person: their own data */}
          <Route path="me" element={<MyProfilePage />} />
          <Route path="my-leave" element={<MyLeavePage />} />
          <Route path="my-trainings" element={<MyTrainingsPage />} />
          <Route path="security" element={<SecurityPage />} />

          <Route element={<RequireRole roles={['HR', 'ADMIN']} />}>
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="leaves" element={<LeavesPage />} />
            <Route path="trainings" element={<TrainingsPage />} />
            <Route path="trainings/:id" element={<TrainingDetailPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="locations/:id" element={<LocationsPage />} />
          </Route>

          <Route element={<RequireRole roles={['ADMIN']} />}>
            <Route path="users" element={<UsersPage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
