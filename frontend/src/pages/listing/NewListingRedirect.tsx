import { Navigate, useParams } from 'react-router-dom'

export default function NewListingRedirect() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/listing/new" replace />
  return <Navigate to={`/listing/${id}/form`} replace />
}
