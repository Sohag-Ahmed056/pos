import { API_BASE_URL } from '../../services/baseQuery';
import { baseApi } from '../../services/baseApi';
import { collectionUrl } from '../../lib/query';
export const reportsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        exportReport: builder.mutation({
            query: ({ name, filters, format = 'xlsx' }) => ({
                url: collectionUrl(`reports/${name}`, { ...filters, format }),
                responseHandler: (response) => (response.ok ? response.blob() : response.json())
            }),
            transformResponse: (blob) => URL.createObjectURL(blob)
        }),
        getReport: builder.query({
            query: ({ name, filters }) => collectionUrl(`reports/${name}`, filters),
            providesTags: ['Reports']
        }),
        getDashboard: builder.query({
            query: (filters = {}) => collectionUrl('dashboard', filters),
            providesTags: ['Reports']
        }),
        getSettlements: builder.query({
            query: ({ party, id }) => `/settlements/${party}/${id}`,
            providesTags: ['Reports', 'Documents']
        })
    })
});
export const { useGetReportQuery, useGetDashboardQuery, useGetSettlementsQuery, useExportReportMutation } =
    reportsApi;

export const reportFileUrl = (name, filters, format) => {
    return `${API_BASE_URL}${collectionUrl(`reports/${name}`, { ...filters, format })}`;
};
