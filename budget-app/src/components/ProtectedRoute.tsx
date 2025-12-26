import { useContext } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import UserContext from "../contexts/user_context"
import { ENABLE_AUTH_PROTECTION } from '@constants'
import { pageContainer } from "../styles/shared"

interface ProtectedRouteProps {
    children?: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const user_context = useContext(UserContext)
    const location = useLocation()

    if (!ENABLE_AUTH_PROTECTION) {
        return children ? <>{children}</> : <Outlet />
    }

    if (!user_context.is_auth_checked) {
        return <div style={pageContainer}>
            <p>Loading...</p>
        </div>
    }

    if (!user_context.is_logged_in) {
        return <Navigate to="/account" state={{ from: location.pathname }} replace />
    }

    return children ? <>{children}</> : <Outlet />
}
