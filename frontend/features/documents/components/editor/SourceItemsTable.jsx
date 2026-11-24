import { money } from '../../../../lib/format';
import { sourceLinePreview, sourceTotalPreview } from '../../model/sourcePreview';
export const SourceItemsTable = ({ kind, items, onChange }) => {
    const total = sourceTotalPreview(items);
    return (
        <div className="mt-6 overflow-x-auto">
            <p className="mb-3 text-xs text-slate-500">
                Enter the quantities {kind === 'grns' ? 'received' : 'returned'} from the original
                transaction. Amounts include the original discounts.
            </p>
            <table>
                <thead>
                    <tr>
                        <th>Original product</th>
                        <th>Remaining PCS</th>
                        <th>{kind === 'grns' ? 'Receive' : 'Return'} PCS</th>
                        <th>{kind === 'sales-returns' ? 'Net return rate' : 'Net unit cost'} · BDT</th>
                        <th>Amount · BDT</th>
                        {kind === 'sales-returns' && <th>Saleable</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={item.source_id}>
                            <td>
                                {item.product_name_snapshot}
                                <p className="text-xs text-slate-400">{item.sku_snapshot}</p>
                            </td>
                            <td>{item.remaining_pcs}</td>
                            <td>
                                <input
                                    aria-label={`Quantity for original line ${item.source_id}`}
                                    type="number"
                                    min="0"
                                    max={item.remaining_pcs}
                                    step="1"
                                    value={item.quantity_pcs}
                                    onChange={(event) => onChange(index, 'quantity_pcs', event.target.value)}
                                />
                            </td>
                            <td>{sourceLinePreview(item).rate}</td>
                            <td>
                                {sourceLinePreview(item).valid
                                    ? money(sourceLinePreview(item).amount)
                                    : 'Check quantity'}
                            </td>
                            {kind === 'sales-returns' && (
                                <td>
                                    <input
                                        aria-label="Return is saleable"
                                        type="checkbox"
                                        checked={item.saleable}
                                        onChange={(event) =>
                                            onChange(index, 'saleable', event.target.checked)
                                        }
                                    />
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="mt-4 text-right text-sm font-semibold" aria-live="polite">
                {kind === 'grns' ? 'Receiving total' : 'Return total'}:{' '}
                {total === null ? 'Check quantities' : `৳ ${money(total)}`}
            </p>
        </div>
    );
};
