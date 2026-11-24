import { useEffect, useState } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import { useListCatalogQuery } from '../catalogApi';
export const useCatalogList = (resource) => {
    const [filters, setFilters] = useState({ search: '', category: '', brand: '', active: '' });
    const [page, setPage] = useState(1);
    const search = useDebounce(filters.search),
        category = useDebounce(filters.category),
        brand = useDebounce(filters.brand);
    useEffect(() => {
        setPage(1);
    }, [search, category, brand, filters.active]);
    const query = useListCatalogQuery({
        resource,
        filters: { page, search, category, brand, active: filters.active }
    });
    return {
        ...query,
        filters,
        setFilter: (key, value) => setFilters((previous) => ({ ...previous, [key]: value })),
        page,
        setPage
    };
};
