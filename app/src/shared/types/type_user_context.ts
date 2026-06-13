export type type_user_context = {
    is_logged_in: boolean,
    is_auth_checked: boolean,
    username: string,
    set_user_context: React.Dispatch<React.SetStateAction<type_user_context>>
}
