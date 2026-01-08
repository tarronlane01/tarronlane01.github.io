import type { UserCredential, User } from "firebase/auth"

export type type_firebase_auth_hook = {
    set_user_listener: (callback: (user: User | null) => void) => void,
    delete_firebase_user: () => Promise<boolean>,
    login_firebase_user: (username: string, password: string) => Promise<UserCredential>,
    logout_firebase_user: () => Promise<void>,
    get_current_firebase_user: () => User | null,
    /** Get the current user's email, throwing if not available */
    requireUserEmail: () => string,
}
