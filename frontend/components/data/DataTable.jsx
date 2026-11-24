import { Empty } from '../ui/EmptyState';
import { Status } from '../ui/StatusBadge';
import { label } from '../../lib/format';
export const DataTable = ({ columns, rows, actions, onRow }) => {
    if (!rows?.length) return <Empty />;
    return (
        <div className="overflow-x-auto">
            <table>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key || c}>{c.title || label(c)}</th>
                        ))}
                        {actions && <th className="text-right">Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.id || index} onDoubleClick={() => onRow?.(row)}>
                            {columns.map((c) => {
                                const key = c.key || c;
                                const value = row[key];
                                return (
                                    <td key={key}>
                                        {c.render ? (
                                            c.render(value, row)
                                        ) : key === 'status' || key === 'is_active' ? (
                                            <Status value={value} />
                                        ) : value === null || value === undefined ? (
                                            '—'
                                        ) : (
                                            String(value)
                                        )}
                                    </td>
                                );
                            })}
                            {actions && (
                                <td>
                                    <div className="flex justify-end gap-2">{actions(row)}</div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
