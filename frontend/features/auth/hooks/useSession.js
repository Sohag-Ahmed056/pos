import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useCurrentUserQuery } from '../authApi';
import { selectUser, setUser } from '../authSlice';
export const useSession = () => {
    const dispatch = useDispatch();
    const user = useSelector(selectUser);
    const { data, isLoading, error } = useCurrentUserQuery();
    useEffect(() => {
        if (data?.data) dispatch(setUser(data.data));
    }, [data, dispatch]);
    return { user, isLoading, error };
};
