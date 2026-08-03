import AdminUserRoster from '@/pages/admin/AdminUserRoster'

export default function AdminMarketingPage() {
  return (
    <AdminUserRoster
      roleFilter="marketing"
      title="Marketing Team"
      description="Manage marketing team members and their platform access."
    />
  )
}
