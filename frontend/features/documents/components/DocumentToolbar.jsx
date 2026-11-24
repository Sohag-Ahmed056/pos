import { SearchInput } from '../../../components/data/SearchInput';
export const DocumentToolbar = ({ kind, search, onSearch, status, onStatus }) => {
    const statuses =
        kind === 'purchases' ? ['DRAFT', 'CONFIRMED', 'CLOSED', 'CANCELLED'] : ['DRAFT', 'POSTED', 'VOID'];
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <SearchInput
                value={search}
                onChange={onSearch}
                placeholder="Search voucher number…"
                label="Search voucher number"
            />
            <select
                className="w-40"
                value={status}
                onChange={(event) => onStatus(event.target.value)}
                aria-label="Filter status"
            >
                <option value="">All statuses</option>
                {statuses.map((value) => (
                    <option key={value}>{value}</option>
                ))}
            </select>
        </div>
    );
};
