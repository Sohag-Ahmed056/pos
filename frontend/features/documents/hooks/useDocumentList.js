import { useEffect, useState } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import { useListDocumentsQuery } from '../documentsApi';
export const useDocumentList = (kind) => {
    const [search, setSearch] = useState(''),
        [status, setStatus] = useState(''),
        [page, setPage] = useState(1);
    const debounced = useDebounce(search);
    useEffect(() => {
        setPage(1);
    }, [debounced, status]);
    const query = useListDocumentsQuery({ resource: kind, filters: { page, search: debounced, status } });
    return { ...query, search, setSearch, status, setStatus, page, setPage };
};
