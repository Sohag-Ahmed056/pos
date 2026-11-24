import { Search } from 'lucide-react';
export const SearchInput = ({
    value,
    onChange,
    placeholder = 'Search records…',
    label = 'Search records'
}) => {
    return (
        <div className="search-box">
            <Search size={16} />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={label}
            />
        </div>
    );
};
