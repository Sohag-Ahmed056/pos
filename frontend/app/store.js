import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../services/baseApi';
import { authReducer } from '../features/auth/authSlice';
import { cartReducer } from '../features/documents/model/cartSlice';
export const store = configureStore({
    reducer: { auth: authReducer, cart: cartReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware)
});
