import { useContext } from "react"
import { Navigate, useLocation } from "react-router-dom"
import UserContext from "../contexts/user_context"

const ENABLE_AUTH_PROTECTION = true

interface ProtectedRouteProps {
    children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const user_context = useContext(UserContext)
    const location = useLocation()

    if (!ENABLE_AUTH_PROTECTION) {
        return <>{children}</>
    }

    if (!user_context.is_auth_checked) {
        return <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
            <p>Loading...</p>
        </div>
    }

    if (!user_context.is_logged_in) {
        return <Navigate to="/account" state={{ from: location.pathname }} replace />
    }

    return <>{children}</>
}
