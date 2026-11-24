import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectRole } from '../../auth/authSlice';
import { useGetDocumentQuery, useSaveDocumentMutation, usePostDocumentMutation } from '../documentsApi';
import { useLazyGetCatalogRecordQuery } from '../../catalog/catalogApi';
import { useGetReportQuery, useGetSettlementsQuery } from '../../reports/reportsApi';
import { useIdempotentMutation } from '../../../hooks/useIdempotentMutation';
import { useToast } from '../../../components/ui/ToastProvider';
import { errorText } from '../../../lib/errors';
import { createDocumentSubmission } from '../model/documentSubmission';
import { documentTypes } from '../config/documentTypes';
import { selectCart, setCart, clearCart } from '../model/cartSlice';
import {
    createDocumentDraft,
    sourceItems,
    addProductLine,
    documentTotals,
    serializeDocument,
    salePostingPayment,
    isPaymentDocument
} from '../model/documentDraft';
export const useDocumentEditor = ({ kind, initial, onClose }) => {
    const config = documentTypes[kind],
        sale = kind === 'sales';
    const dispatch = useDispatch();
    const role = useSelector(selectRole);
    const cart = useSelector(selectCart);
    const [form, setForm] = useState(() => createDocumentDraft(kind, initial));
    const [items, setItems] = useState(() => initial?.items || (sale ? cart : []));
    const [allocations, setAllocations] = useState(() =>
        Object.fromEntries(
            (isPaymentDocument(kind) ? initial?.items || [] : []).map((item) => [
                item[kind === 'receipts' ? 'sales_invoice_id' : 'goods_receipt_id'],
                item.amount
            ])
        )
    );
    const [productId, setProductId] = useState(''),
        [quick, setQuick] = useState(null),
        [error, setError] = useState(null),
        [confirm, setConfirm] = useState(false);
    const [payment, setPayment] = useState({ amount: 0, payment_account_id: '' });
    const [saveDraft, saveState] = useIdempotentMutation(useSaveDocumentMutation());
    const [post, postState] = useIdempotentMutation(usePostDocumentMutation());
    const [loadProduct] = useLazyGetCatalogRecordQuery();
    const submission = useRef(null);
    if (!submission.current) submission.current = createDocumentSubmission(initial?.id);
    const initializedSource = useRef(null);
    const toast = useToast();
    const sourceQuery = useGetDocumentQuery(
        { resource: config.sourceResource, id: form[config.source] },
        { skip: !config.source || !form[config.source] }
    );
    const dueQuery = useGetReportQuery(
        { name: 'customer-outstanding', filters: { customer_id: form.customer_id } },
        { skip: !sale || !form.customer_id }
    );
    const settlementsQuery = useGetSettlementsQuery(
        { party: kind === 'receipts' ? 'customer' : 'supplier', id: form[config.party] },
        { skip: !isPaymentDocument(kind) || !form[config.party] }
    );
    const source = { ...sourceQuery, data: sourceQuery.currentData };
    const due = { ...dueQuery, data: dueQuery.currentData };
    const settlements = { ...settlementsQuery, data: settlementsQuery.currentData };
    const sourceId = form[config.source];
    useEffect(() => {
        if (source.data?.data && String(sourceId) !== initializedSource.current) {
            setItems(sourceItems(kind, source.data.data, initial));
            initializedSource.current = String(sourceId);
        }
    }, [source.data, sourceId, kind, initial]);
    useEffect(() => {
        if (sale && !initial) dispatch(setCart(items));
    }, [items, sale, initial, dispatch]);
    const set = (key, value) => {
        setForm((previous) => ({ ...previous, [key]: value }));
        if (key === config.party && value !== form[key]) setAllocations({});
    };
    const selectSource = (value) => {
        initializedSource.current = null;
        set(config.source, value);
        setItems([]);
    };
    const updateItem = (index, key, value) =>
        setItems((previous) => previous.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
    const addProduct = async () => {
        if (!productId) return;
        try {
            const response = await loadProduct({ resource: 'products', id: productId }, true).unwrap();
            setItems((previous) => addProductLine(previous, response.data, kind));
            setProductId('');
        } catch (failure) {
            toast(errorText(failure), true);
        }
    };
    const save = async (postNow) => {
        setError(null);
        try {
            await submission.current(
                {
                    kind,
                    values: serializeDocument(kind, { form, items, allocations }),
                    payment: salePostingPayment(kind, payment),
                    postNow
                },
                { saveDraft, post }
            );
            toast(
                postNow ? (kind === 'purchases' ? 'Purchase confirmed' : 'Document posted') : 'Draft saved'
            );
            if (sale) dispatch(clearCart());
            onClose();
        } catch (failure) {
            setError(failure);
            setConfirm(false);
        }
    };
    return {
        config,
        form,
        set,
        items,
        updateItem,
        removeItem: (index) => setItems((previous) => previous.filter((_, i) => i !== index)),
        productId,
        setProductId,
        addProduct,
        allocations,
        setAllocation: (id, value) => setAllocations((previous) => ({ ...previous, [id]: value })),
        payment,
        setPayment,
        source,
        selectSource,
        settlements,
        totals: documentTotals(
            items,
            form.discount_amount,
            due.data?.data?.rows?.[0]?.balance,
            payment.amount
        ),
        dueError: due.error,
        dueLoading: due.isFetching && !due.currentData,
        quick,
        setQuick,
        quickSaved: (row) =>
            quick === 'products' ? setProductId(String(row.id)) : set(config.party, String(row.id)),
        error,
        confirm,
        setConfirm,
        save,
        busy: saveState.isLoading || postState.isLoading,
        canPost: kind !== 'adjustments' || ['ADMIN', 'MANAGER'].includes(role)
    };
};
