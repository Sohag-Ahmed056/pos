import { baseApi } from './baseApi';
import { collectionUrl } from '../lib/query';
const documentResources = new Set([
    'sales',
    'purchases',
    'grns',
    'receipts',
    'payments',
    'sales-returns',
    'purchase-returns',
    'adjustments',
    'expenses'
]);
const tag = (resource) => ({ type: documentResources.has(resource) ? 'Documents' : 'Catalog', id: resource });
// Shared resource reads let lookups and feature screens reuse the same RTK Query cache.
export const entityApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listEntities: builder.query({
            query: ({ resource, filters }) => collectionUrl(resource, filters),
            providesTags: (_, __, { resource }) => [tag(resource)]
        }),
        getEntity: builder.query({
            query: ({ resource, id }) => `/${resource}/${id}`,
            providesTags: (_, __, { resource }) => [tag(resource)]
        })
    })
});
export const { useListEntitiesQuery, useGetEntityQuery, useLazyGetEntityQuery } = entityApi;
