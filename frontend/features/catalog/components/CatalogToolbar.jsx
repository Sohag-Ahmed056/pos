import { SearchInput } from '../../../components/data/SearchInput';
export const CatalogToolbar = ({ resource, title, filters, onChange, total }) => {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <SearchInput
                value={filters.search}
                onChange={(value) => onChange('search', value)}
                placeholder={`Search ${title.toLowerCase()}…`}
            />
            {resource === 'products' && (
                <div className="flex flex-wrap gap-2">
                    <input
                        className="w-32"
                        aria-label="Category filter"
                        placeholder="Category"
                        value={filters.category}
                        onChange={(event) => onChange('category', event.target.value)}
                    />
                    <input
                        className="w-32"
                        aria-label="Brand filter"
                        placeholder="Brand"
                        value={filters.brand}
                        onChange={(event) => onChange('brand', event.target.value)}
                    />
                    <select
                        className="w-32"
                        aria-label="Active filter"
                        value={filters.active}
                        onChange={(event) => onChange('active', event.target.value)}
                    >
                        <option value="">All statuses</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>
            )}
            <span className="text-xs text-slate-400">{total || 0} records</span>
        </div>
    );
};
