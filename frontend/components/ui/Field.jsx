import { label } from '../../lib/format';
export const Field = ({ title, type = 'text', value, onChange, required = false, options, ...props }) => {
    const component = options ? (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} {...props}>
            <option value="">Select…</option>
            {options.map((o) => (
                <option key={o.value ?? o} value={o.value ?? o}>
                    {o.label ?? label(o)}
                </option>
            ))}
        </select>
    ) : type === 'checkbox' ? (
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} {...props} />
    ) : (
        <input
            type={type}
            value={value ?? ''}
            onChange={(e) =>
                onChange(
                    type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                )
            }
            required={required}
            {...props}
        />
    );
    return (
        <label className="field">
            <span>
                {title}
                {required && <span className="text-red-600"> *</span>}
            </span>
            {component}
        </label>
    );
};
