import { useDispatch } from 'react-redux';
import { baseApi } from '../../../services/baseApi';
import { clearCart } from '../../documents/model/cartSlice';
import { setUser } from '../authSlice';
import { useLogoutMutation, useChangePasswordMutation } from '../authApi';
export const useAuthActions = () => {
    const dispatch = useDispatch();
    const [logout, logoutState] = useLogoutMutation();
    const [changePassword, passwordState] = useChangePasswordMutation();
    const clearSession = () => {
        dispatch(setUser(null));
        dispatch(clearCart());
        dispatch(baseApi.util.resetApiState());
    };
    return {
        signOut: async () => {
            await logout().unwrap();
            clearSession();
        },
        changePassword: async (values) => {
            await changePassword(values).unwrap();
            clearSession();
        },
        isSigningOut: logoutState.isLoading,
        isChangingPassword: passwordState.isLoading
    };
};
