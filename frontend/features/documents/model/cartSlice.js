import { createSlice } from '@reduxjs/toolkit';
const cart = createSlice({
    name: 'cart',
    initialState: { items: [] },
    reducers: {
        setCart: (state, action) => {
            state.items = action.payload;
        },
        clearCart: (state) => {
            state.items = [];
        }
    }
});
export const { setCart, clearCart } = cart.actions;
export const cartReducer = cart.reducer;
export const selectCart = (state) => state.cart.items;
