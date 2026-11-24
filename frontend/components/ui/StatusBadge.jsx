import { label } from '../../lib/format';
export const Status = ({ value }) => {
    return (
        <span
            className={`status ${['POSTED', 'CONFIRMED', 'CLOSED', 'true', '1'].includes(String(value)) ? 'status-green' : ['VOID', 'CANCELLED', 'false', '0'].includes(String(value)) ? 'status-grey' : 'status-amber'}`}
        >
            {typeof value === 'boolean'
                ? value
                    ? 'Active'
                    : 'Inactive'
                : label(String(value || '—')).toLowerCase()}
        </span>
    );
};
