import { useContext, useEffect } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useApp } from "../contexts/app_context"
import UserContext from "../contexts/user_context"
import { ENABLE_AUTH_PROTECTION } from '@constants'

interface ProtectedRouteProps {
    children?: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { addLoadingHold, removeLoadingHold } = useApp()
    const user_context = useContext(UserContext)
    const location = useLocation()

    // Add loading hold during auth check
    useEffect(() => {
        if (!user_context.is_auth_checked) {
            addLoadingHold('protected-route', 'Checking authentication...')
        } else {
            removeLoadingHold('protected-route')
        }
        return () => removeLoadingHold('protected-route')
    }, [user_context.is_auth_checked, addLoadingHold, removeLoadingHold])

    if (!ENABLE_AUTH_PROTECTION) {
        return children ? <>{children}</> : <Outlet />
    }

    if (!user_context.is_auth_checked) return null

    if (!user_context.is_logged_in) {
        return <Navigate to="/account" state={{ from: location.pathname }} replace />
    }

    return children ? <>{children}</> : <Outlet />
}
