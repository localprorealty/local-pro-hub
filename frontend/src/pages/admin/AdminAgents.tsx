import AdminUserRoster from '@/pages/admin/AdminUserRoster'

export default function AdminAgentsPage() {
  return (
    <AdminUserRoster
      roleFilter="agent"
      title="Agents"
      description="Manage agent accounts, edit profiles, and control access."
    />
  )
}
