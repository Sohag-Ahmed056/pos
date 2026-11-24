import { baseApi } from '../../services/baseApi';
import { mutationRequest } from '../../lib/query';
export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        currentUser: builder.query({ query: () => '/auth/me', providesTags: ['Session'] }),
        login: builder.mutation({ query: (values) => mutationRequest('/auth/login', values) }),
        logout: builder.mutation({ query: () => mutationRequest('/auth/logout') }),
        changePassword: builder.mutation({
            query: (values) => mutationRequest('/auth/change-password', values)
        })
    })
});
export const { useCurrentUserQuery, useLoginMutation, useLogoutMutation, useChangePasswordMutation } =
    authApi;
