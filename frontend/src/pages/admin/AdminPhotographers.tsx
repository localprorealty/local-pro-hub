import AdminUserRoster from '@/pages/admin/AdminUserRoster'

export default function AdminPhotographersPage() {
  return (
    <AdminUserRoster
      roleFilter="photographer"
      title="Photographers"
      description="Manage photographer accounts, tiers, and roster access."
    />
  )
}
