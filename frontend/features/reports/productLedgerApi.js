import { baseApi } from '../../services/baseApi';
import { API_BASE_URL } from '../../services/baseQuery';
import { collectionUrl } from '../../lib/query';

export const productLedgerPath = (resource, id, filters = {}) =>
    collectionUrl(`product-ledgers/${resource}/${id}`, filters);
export const productLedgerFileUrl = (resource, id, filters, format) =>
    `${API_BASE_URL}${productLedgerPath(resource, id, { ...filters, page: undefined, format })}`;
export const productLedgerApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getProductLedger: builder.query({
            query: ({ resource, id, filters }) => productLedgerPath(resource, id, filters),
            providesTags: ['Reports', 'Documents', 'Catalog']
        })
    })
});
export const { useGetProductLedgerQuery } = productLedgerApi;
