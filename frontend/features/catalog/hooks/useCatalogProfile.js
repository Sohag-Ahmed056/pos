import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectRole } from '../../auth/authSlice';
import { canReadDocument } from '../../auth/permissions';
import { useDebounce } from '../../../hooks/useDebounce';
import { useGetCatalogHistoryQuery } from '../catalogApi';
import { useGetReportQuery } from '../../reports/reportsApi';
import { useListDocumentsQuery } from '../../documents/documentsApi';
export const useCatalogProfile = (resource, id) => {
    const role = useSelector(selectRole);
    const product = resource === 'products';
    const party = resource === 'customers' ? 'customer' : 'supplier';
    const [historyType, setHistoryType] = useState(product ? 'movements' : 'transactions');
    const [page, setPage] = useState(1),
        [paymentPage, setPaymentPage] = useState(1);
    const [search, setSearch] = useState(''),
        [paymentSearch, setPaymentSearch] = useState('');
    const [period, setPeriod] = useState({ from: '', to: '' });
    const debounced = useDebounce(search),
        paymentDebounced = useDebounce(paymentSearch);
    useEffect(() => {
        setPage(1);
    }, [debounced, historyType, period.from, period.to]);
    useEffect(() => {
        setPaymentPage(1);
    }, [paymentDebounced, period.from, period.to]);
    const history = useGetCatalogHistoryQuery({
        resource,
        id,
        page,
        filters: { type: historyType, search: debounced, ...period, limit: 10 }
    });
    const balance = useGetReportQuery(
        { name: `${party}-outstanding`, filters: { [`${party}_id`]: id } },
        { skip: product }
    );
    const paymentResource = resource === 'customers' ? 'receipts' : 'payments';
    const canViewPayments = !product && canReadDocument(paymentResource, role);
    const payments = useListDocumentsQuery(
        {
            resource: paymentResource,
            filters: { party_id: id, page: paymentPage, search: paymentDebounced, ...period, limit: 10 }
        },
        { skip: !canViewPayments }
    );
    return {
        role,
        party,
        history,
        balance,
        payments,
        canViewPayments,
        paymentResource,
        page,
        setPage,
        paymentPage,
        setPaymentPage,
        search,
        setSearch,
        paymentSearch,
        setPaymentSearch,
        historyType,
        setHistoryType,
        period,
        setPeriod
    };
};
