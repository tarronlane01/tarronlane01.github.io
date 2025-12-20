import type { UserCredential } from "firebase/auth"

export type type_firebase_auth_hook = {
    set_user_listener: (callback: (user: any) => void) => void,
    delete_firebase_user: () => Promise<boolean>,
    login_firebase_user: (username: string, password: string) => Promise<UserCredential>,
    logout_firebase_user: () => Promise<void>,
    get_current_firebase_user: () => any,
}
