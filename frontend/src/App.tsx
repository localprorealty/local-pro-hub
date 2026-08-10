import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GridBackground } from '@/components/layout/GridBackground'
import type { UserProfile, UserRole } from '@/lib/auth'
import { getSupabaseClient } from '@/lib/supabase'
import AdminAgentsPage from '@/pages/admin/AdminAgents'
import AdminApprovalsPage from '@/pages/admin/AdminApprovals'
import AdminAutomationsPage from '@/pages/admin/AdminAutomations'
import AdminMarketingPage from '@/pages/admin/AdminMarketing'
import AdminPhotographersPage from '@/pages/admin/AdminPhotographers'
import AdminPipelinePage from '@/pages/admin/AdminPipeline'
import AdminBrokerMintPage from '@/pages/admin/AdminBrokerMintPage'
import RevenueOverviewPage from '@/pages/admin/RevenueOverviewPage'
import RevenueSharePage from '@/pages/admin/RevenueSharePage'
import DashboardPage from '@/pages/agent/Dashboard'
import OverviewPage from '@/pages/agent/OverviewPage'
import MarketYourselfPage from '@/pages/agent/MarketYourselfPage'
import ListingDetailPage from '@/pages/listing/ListingDetailPage'
import ListingFormPage from '@/pages/listing/ListingFormPage'
import PhotographyPage from '@/pages/listing/PhotographyPage'
import GoLivePage from '@/pages/listing/GoLivePage'
import MarketingPage from '@/pages/listing/MarketingPage'
import MarketingAssetsPage from '@/pages/listing/MarketingAssetsPage'
import MlsSubmissionPage from '@/pages/listing/MlsSubmissionPage'
import NewListingPage from '@/pages/listing/NewListingPage'
import NewListingRedirect from '@/pages/listing/NewListingRedirect'
import ProfilePage from '@/pages/profile/ProfilePage'
import LoginPage from '@/pages/auth/Login'
import SignupPage from '@/pages/auth/Signup'
import SignupPendingPage from '@/pages/auth/SignupPending'
import ResetPasswordPage from '@/pages/auth/ResetPassword'
import PhotographerCalendarPage from '@/pages/photographer/PhotographerCalendar'
import ExtensionInstallPage from '@/pages/ExtensionInstall'

type AuthState = {
  isLoading: boolean
  session: Session | null
  profile: UserProfile | null
}

function resolveHomeRoute(profile: UserProfile | null): string {
  if (!profile) return '/login'
  if (profile.status === 'pending') return '/signup/pending'
  if (profile.status === 'suspended') return '/login'
  if (profile.role === 'admin') return '/admin/pipeline'
  if (profile.role === 'photographer') return '/photographer/calendar'
  return '/dashboard'
}

function FullPageLoader() {
  return (
    <main className="relative flex min-h-svh items-center justify-center text-[var(--color-text-secondary)]">
      Loading...
    </main>
  )
}

type GuardProps = {
  state: AuthState
  children: ReactNode
  allowedRoles?: UserRole[]
}

function ProtectedRoute({ state, children, allowedRoles }: GuardProps) {
  if (state.isLoading) return <FullPageLoader />
  if (!state.session || !state.profile) return <Navigate to="/login" replace />
  if (state.profile.status === 'pending') {
    return <Navigate to="/signup/pending" replace />
  }
  if (state.profile.status === 'suspended') {
    return <Navigate to="/login" replace />
  }
  if (
    allowedRoles &&
    (!state.profile.role || !allowedRoles.includes(state.profile.role))
  ) {
    return <Navigate to={resolveHomeRoute(state.profile)} replace />
  }

  return <>{children}</>
}

function RevenueRoute({ state, children }: { state: AuthState; children: ReactNode }) {
  if (state.isLoading) return <FullPageLoader />
  if (!state.session || !state.profile) return <Navigate to="/login" replace />
  if (state.profile.status === 'pending') {
    return <Navigate to="/signup/pending" replace />
  }
  if (state.profile.status === 'suspended') {
    return <Navigate to="/login" replace />
  }
  if (state.profile.role !== 'admin' || !state.profile.can_view_revenue) {
    return <Navigate to={resolveHomeRoute(state.profile)} replace />
  }

  return <>{children}</>
}

function PublicOnlyRoute({ state, children }: Omit<GuardProps, 'allowedRoles'>) {
  if (state.isLoading) return <FullPageLoader />
  if (state.session && state.profile) {
    return <Navigate to={resolveHomeRoute(state.profile)} replace />
  }
  return <>{children}</>
}

function PendingRoute({ state, children }: Omit<GuardProps, 'allowedRoles'>) {
  if (state.isLoading) return <FullPageLoader />
  if (!state.session || !state.profile) return <>{children}</>
  if (state.profile.status === 'pending') return <>{children}</>
  return <Navigate to={resolveHomeRoute(state.profile)} replace />
}

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: true,
    session: null,
    profile: null,
  })

  useEffect(() => {
    const supabase = getSupabaseClient()
    let isMounted = true

    const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, status, role, can_view_revenue')
        .eq('id', userId)
        .maybeSingle()

      if (error || !data) return null

      return {
        id: data.id as string,
        status: data.status as UserProfile['status'],
        role: (data.role as UserProfile['role']) ?? null,
        can_view_revenue: data.can_view_revenue as boolean | null,
      }
    }

    const syncAuthState = async (session: Session | null) => {
      if (!isMounted) return
      if (!session?.user) {
        setAuthState({ isLoading: false, session: null, profile: null })
        return
      }

      const profile = await fetchProfile(session.user.id)
      if (!isMounted) return
      setAuthState({ isLoading: false, session, profile })
    }

    const initialize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      await syncAuthState(session)
    }

    void initialize()

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void syncAuthState(session)
      },
    )

    return () => {
      isMounted = false
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  const dashboardRole = useMemo<Exclude<UserRole, 'admin'>>(() => {
    const role = authState.profile?.role
    if (role === 'marketing' || role === 'photographer') return role
    return 'agent'
  }, [authState.profile?.role])

  const listingDetailRole = useMemo<UserRole>(() => {
    const role = authState.profile?.role
    if (
      role === 'admin' ||
      role === 'agent' ||
      role === 'marketing' ||
      role === 'photographer'
    ) {
      return role
    }
    return 'agent'
  }, [authState.profile?.role])

  return (
    <div className="relative min-h-svh bg-[var(--color-black)]">
      <GridBackground fixed />
      <BrowserRouter>
        <ErrorBoundary title="Application">
          <div className="relative z-10 min-h-svh">
            <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute state={authState}>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/reset-password"
            element={<ResetPasswordPage />}
          />
          <Route
            path="/extension"
            element={<ExtensionInstallPage state={authState} />}
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute state={authState}>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup/pending"
            element={
              <PendingRoute state={authState}>
                <SignupPendingPage />
              </PendingRoute>
            }
          />
          <Route
            path="/admin/pipeline"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminPipelinePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/approvals"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminApprovalsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/approval" element={<Navigate to="/admin/approvals" replace />} />
          <Route
            path="/admin/agents"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminAgentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/photographers"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminPhotographersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/marketing"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminMarketingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminAutomationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/brokermint"
            element={
              <ProtectedRoute state={authState} allowedRoles={['admin']}>
                <AdminBrokerMintPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/revenue"
            element={
              <RevenueRoute state={authState}>
                <RevenueOverviewPage />
              </RevenueRoute>
            }
          />
          <Route
            path="/admin/revenue-share"
            element={
              <RevenueRoute state={authState}>
                <RevenueSharePage />
              </RevenueRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute
                state={authState}
                allowedRoles={['agent', 'marketing', 'photographer', 'admin']}
              >
                <ProfilePage role={listingDetailRole} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market-yourself"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <MarketYourselfPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/new"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <NewListingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/new/:id"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <NewListingRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/form"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <ListingFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/photography"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <PhotographyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/go-live"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <GoLivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/marketing"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <MarketingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/marketing-assets"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <MarketingAssetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:id/mls"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <MlsSubmissionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/listing/:listingId"
            element={
              <ProtectedRoute
                state={authState}
                allowedRoles={['agent', 'marketing', 'photographer', 'admin']}
              >
                <ListingDetailPage role={listingDetailRole} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/photographer/calendar"
            element={
              <ProtectedRoute state={authState} allowedRoles={['photographer']}>
                <PhotographerCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                state={authState}
                allowedRoles={['agent', 'marketing', 'photographer']}
              >
                <DashboardPage role={dashboardRole} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/overview"
            element={
              <ProtectedRoute state={authState} allowedRoles={['agent']}>
                <OverviewPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={resolveHomeRoute(authState.profile)} replace />} />
          <Route path="*" element={<Navigate to={resolveHomeRoute(authState.profile)} replace />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  )
}

export default App
