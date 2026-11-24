import { createSlice } from '@reduxjs/toolkit';
const auth = createSlice({
    name: 'auth',
    initialState: { user: null },
    reducers: {
        setUser: (state, action) => {
            state.user = action.payload;
        }
    }
});
export const { setUser } = auth.actions;
export const authReducer = auth.reducer;
export const selectUser = (state) => state.auth.user;
export const selectRole = (state) => state.auth.user?.role;
