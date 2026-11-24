import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setUser } from '../authSlice';
import { useLoginMutation } from '../authApi';
import { useToast } from '../../../components/ui/ToastProvider';
export const useLoginForm = () => {
    const dispatch = useDispatch();
    const toast = useToast();
    const [login, { isLoading }] = useLoginMutation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const submit = async (event) => {
        event.preventDefault();
        setError(null);
        try {
            const result = await login({ email, password }).unwrap();
            dispatch(setUser(result.data.admin));
            toast('Signed in successfully');
        } catch (failure) {
            setError(failure);
        }
    };
    return { email, setEmail, password, setPassword, error, isLoading, submit };
};
