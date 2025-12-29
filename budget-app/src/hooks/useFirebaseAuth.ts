import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth";
import app from '@firestore/app'
import type { type_firebase_auth_hook } from '@types'

export default function useFirebaseAuth() {
    const firebase_auth = getAuth(app);

    async function delete_firebase_user() {
        return false;
    }

    async function login_firebase_user(username: string, password: string) {
        return signInWithEmailAndPassword(firebase_auth, username, password);
    }

    function logout_firebase_user() {
        return signOut(firebase_auth);
    }

    function set_user_listener(auth_changed_callback: (user: User | null) => void) {
        onAuthStateChanged(firebase_auth, (user) => {
            auth_changed_callback(user);
        });
    }

    function get_current_firebase_user() {
        return firebase_auth.currentUser
    }

    const firebase_auth_hook: type_firebase_auth_hook = {
        set_user_listener,
        delete_firebase_user,
        login_firebase_user,
        logout_firebase_user,
        get_current_firebase_user,
    }

    return firebase_auth_hook
}

