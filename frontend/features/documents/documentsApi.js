import { baseApi } from '../../services/baseApi';
import { mutationRequest } from '../../lib/query';
export {
    useListEntitiesQuery as useListDocumentsQuery,
    useGetEntityQuery as useGetDocumentQuery,
    useLazyGetEntityQuery as useLazyGetDocumentQuery
} from '../../services/entityApi';
export const documentsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getPendingPurchases: builder.query({
            query: ({ page, search }) =>
                `/pending-purchases?page=${page}&search=${encodeURIComponent(search)}`,
            providesTags: ['Documents']
        }),
        saveDocument: builder.mutation({
            query: ({ kind, id, values, key }) =>
                mutationRequest(`/${kind}${id ? `/${id}` : ''}`, values, id ? 'PUT' : 'POST', key),
            invalidatesTags: (_, error, { kind }) => (error ? [] : [{ type: 'Documents', id: kind }])
        }),
        postDocument: builder.mutation({
            query: ({ kind, id, values = {}, key }) =>
                mutationRequest(`/${kind}/${id}/post`, values, 'POST', key),
            invalidatesTags: (_, error) => (error ? [] : ['Documents', 'Reports'])
        }),
        allocatePayment: builder.mutation({
            query: ({ kind, id, allocations, key }) =>
                mutationRequest(`/${kind}/${id}/allocations`, { allocations }, 'POST', key),
            invalidatesTags: (_, error) => (error ? [] : ['Documents', 'Reports'])
        })
    })
});
export const {
    useSaveDocumentMutation,
    usePostDocumentMutation,
    useAllocatePaymentMutation,
    useGetPendingPurchasesQuery
} = documentsApi;
