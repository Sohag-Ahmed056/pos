import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setUser } from '../features/auth/authSlice';
import { clearCart } from '../features/documents/model/cartSlice';
export const API_BASE_URL = '/api/v1';
const request = fetchBaseQuery({ baseUrl: API_BASE_URL, credentials: 'include' });
let refreshPromise;
export const baseQuery = async (args, api, options) => {
    let result = await request(args, api, options);
    const url = typeof args === 'string' ? args : args.url;
    if (result.error?.status !== 401 || (url.startsWith('/auth/') && url !== '/auth/me')) return result;
    // Concurrent expired requests share one refresh so a rotating token is consumed once.
    refreshPromise ||= request({ url: '/auth/refresh', method: 'POST', body: {} }, api, options).finally(
        () => {
            refreshPromise = null;
        }
    );
    const refreshed = await refreshPromise;
    if (refreshed.data) return request(args, api, options);
    api.dispatch(setUser(null));
    api.dispatch(clearCart());
    return result;
};
