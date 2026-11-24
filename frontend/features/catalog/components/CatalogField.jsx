import { ResourceLookup } from '../../../components/data/ResourceLookup';
import { Field } from '../../../components/ui/Field';
export const CatalogField = ({ definition, value, onChange, creating, onQuickAccount }) => {
    const [key, title, type = 'text', required = false, options] = definition;
    if (type === 'account')
        return (
            <ResourceLookup
                title={title}
                resource="accounts"
                value={value}
                onChange={onChange}
                onQuickAdd={onQuickAccount}
            />
        );
    return (
        <Field
            title={title}
            type={['decimal', 'integer'].includes(type) ? 'number' : type === 'select' ? 'text' : type}
            step={type === 'decimal' ? '0.0001' : type === 'integer' ? '1' : undefined}
            min={['decimal', 'integer'].includes(type) ? 0 : undefined}
            minLength={type === 'password' ? 12 : undefined}
            value={value}
            onChange={onChange}
            required={required || (creating && key === 'password')}
            options={options}
        />
    );
};
