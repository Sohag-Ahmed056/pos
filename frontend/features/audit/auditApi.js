import { baseApi } from '../../services/baseApi';
import { collectionUrl } from '../../lib/query';
export const auditApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getAuditHistory: builder.query({
            query: (filters) => collectionUrl('audit-logs', filters),
            providesTags: ['Reports']
        })
    })
});
export const { useGetAuditHistoryQuery } = auditApi;
