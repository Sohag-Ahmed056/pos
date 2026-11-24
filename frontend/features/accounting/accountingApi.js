import { baseApi } from '../../services/baseApi';
import { mutationRequest } from '../../lib/query';
export const accountingApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        postJournal: builder.mutation({
            query: ({ values, key }) => mutationRequest('/journals', values, 'POST', key),
            invalidatesTags: (_, error) => (error ? [] : ['Reports', 'Documents'])
        }),
        reverseJournal: builder.mutation({
            query: ({ id, values, key }) => mutationRequest(`/journals/${id}/reverse`, values, 'POST', key),
            invalidatesTags: (_, error) => (error ? [] : ['Reports', 'Documents'])
        })
    })
});
export const { usePostJournalMutation, useReverseJournalMutation } = accountingApi;
