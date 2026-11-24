import { baseApi } from '../../services/baseApi';
import { collectionUrl, mutationRequest } from '../../lib/query';
export {
    useListEntitiesQuery as useListCatalogQuery,
    useGetEntityQuery as useGetCatalogRecordQuery,
    useLazyGetEntityQuery as useLazyGetCatalogRecordQuery
} from '../../services/entityApi';
export const catalogApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getCatalogHistory: builder.query({
            query: ({ resource, id, page = 1, filters = {} }) =>
                collectionUrl(`${resource}/${id}/history`, { ...filters, page }),
            providesTags: (_, __, { resource }) => [{ type: 'Catalog', id: resource }, 'Documents']
        }),
        saveCatalogRecord: builder.mutation({
            query: ({ resource, id, values, key }) =>
                mutationRequest(`/${resource}${id ? `/${id}` : ''}`, values, id ? 'PUT' : 'POST', key),
            invalidatesTags: (_, error, { resource }) =>
                error ? [] : [{ type: 'Catalog', id: resource }, 'Reports']
        }),
        deleteCatalogRecord: builder.mutation({
            query: ({ resource, id }) => mutationRequest(`/${resource}/${id}`, {}, 'DELETE'),
            invalidatesTags: (_, error, { resource }) =>
                error ? [] : [{ type: 'Catalog', id: resource }, 'Reports']
        })
    })
});
export const { useGetCatalogHistoryQuery, useSaveCatalogRecordMutation, useDeleteCatalogRecordMutation } =
    catalogApi;
