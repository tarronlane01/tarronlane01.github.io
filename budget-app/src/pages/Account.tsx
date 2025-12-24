import { useContext, useState, useEffect, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import UserContext from "../contexts/user_context"
import useFirebaseAuth from "../hooks/useFirebaseAuth"
import { DropdownMenu, type MenuItem } from "../components/ui"

export default function Account() {
    const user_context = useContext(UserContext)
    const firebase_auth_hook = useFirebaseAuth()
    const [is_logging_out, set_is_logging_out] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    const redirect_path = (location.state as { from?: string })?.from || "/"

    // Redirect to original page after login
    useEffect(() => {
        if (user_context.is_logged_in && redirect_path !== "/") {
            navigate(redirect_path, { replace: true })
        }
    }, [user_context.is_logged_in, redirect_path, navigate])

    function logout_action() {
        set_is_logging_out(true)
        firebase_auth_hook.logout_firebase_user().then(function() {
            set_is_logging_out(false)
        })
    }

    return (
        <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
            <nav style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Link to="/" style={{ opacity: 0.6, fontSize: '1.5rem', textDecoration: 'none', padding: '0.25rem 0.5rem' }} title="Back to Home">←</Link>
                </div>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }} title="Tarron Lane Home">
                    <img src="/t-icon.svg" alt="Tarron Lane" style={{ width: '1.5rem', height: '1.5rem' }} />
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Account</span>
                </Link>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <DropdownMenu items={[
                        { label: 'Budget', icon: '💰', to: '/budget' },
                        { label: 'Account', icon: '👤', to: '/account' },
                    ] as MenuItem[]} />
                </div>
            </nav>
            <h1>Account</h1>
            {
                user_context.is_logged_in
                ? (
                    is_logging_out
                    ? <p>Logging Out...</p>
                    : <>
                        <p>You are logged in as {user_context.username}</p>
                        <button onClick={logout_action} style={{ marginTop: '1rem' }}>Logout</button>
                    </>
                )
                : <LoginForm />
            }
        </div>
    )
}

function LoginForm() {
    const firebase_auth_hook = useFirebaseAuth()
    const [username, set_username] = useState("")
    const [password, set_password] = useState("")
    const [is_loading, set_is_loading] = useState(false)
    const [error_message, set_error_message] = useState("")

    function handle_username_input(event: FormEvent<HTMLInputElement>) {
        set_username((event.target as HTMLInputElement).value)
    }

    function handle_password_input(event: FormEvent<HTMLInputElement>) {
        set_password((event.target as HTMLInputElement).value)
    }

    function handle_submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        set_is_loading(true)
        set_error_message("")
        firebase_auth_hook.login_firebase_user(username, password).then(
            function() {
                // Login successful - auth state listener will update context
                // useEffect in parent will handle redirect
            }
        ).catch(
            function() {
                set_error_message("Incorrect login credentials")
            }
        ).finally(
            function() {
                set_is_loading(false)
            }
        )
    }

    return (
        <form onSubmit={handle_submit}>
            <div>
                <label htmlFor="username">Email: </label>
                <input id="username" type="email" value={username} onChange={handle_username_input}/>
            </div>
            <div>
                <label htmlFor="password">Password: </label>
                <input id="password" type="password" value={password} onChange={handle_password_input}/>
            </div>
            {
                is_loading
                ? <p>Logging in...</p>
                : <button>Login</button>
            }
            {error_message && <p style={{color: 'red'}}>{error_message}</p>}
        </form>
    )
}
