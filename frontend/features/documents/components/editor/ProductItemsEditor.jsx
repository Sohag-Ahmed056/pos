import { Plus, Trash2 } from 'lucide-react';
import { ResourceLookup } from '../../../../components/data/ResourceLookup';
import { Button } from '../../../../components/ui/Button';
import { money } from '../../../../lib/format';
import { lineTotal } from '../../model/documentDraft';
export const ProductItemsEditor = ({
    kind,
    items,
    productId,
    onSelectProduct,
    onAddProduct,
    onQuickAdd,
    onChange,
    onRemove
}) => {
    const sale = kind === 'sales';
    const priceKey = sale ? 'unit_price' : 'unit_cost';
    return (
        <>
            <div className="my-6 grid items-end gap-3 rounded-lg bg-canvas p-4 sm:grid-cols-[1fr_auto]">
                <ResourceLookup
                    resource="products"
                    title="Add product by name or SKU"
                    required={false}
                    filters={{ active: true }}
                    value={productId}
                    onChange={onSelectProduct}
                    onQuickAdd={kind === 'purchases' ? () => onQuickAdd('products') : undefined}
                />
                <Button variant="secondary" className="h-10" onClick={onAddProduct} disabled={!productId}>
                    <Plus size={16} />
                    Add item
                </Button>
            </div>
            <div className="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Quantity · PCS</th>
                            <th>{sale ? 'Price' : 'Cost'} · BDT</th>
                            <th>Line discount</th>
                            <th>Amount</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.product_id}>
                                <td>
                                    <p className="font-medium">{item.product_name_snapshot}</p>
                                    <p className="text-xs text-slate-400">{item.sku_snapshot}</p>
                                </td>
                                <td>
                                    <input
                                        aria-label={`Quantity for ${item.sku_snapshot}`}
                                        className="min-w-20"
                                        type="number"
                                        min="1"
                                        step="1"
                                        required
                                        value={item.quantity_pcs}
                                        onChange={(event) =>
                                            onChange(index, 'quantity_pcs', event.target.value)
                                        }
                                    />
                                </td>
                                <td>
                                    <input
                                        aria-label={`Price for ${item.sku_snapshot}`}
                                        className="min-w-24"
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        required
                                        value={item[priceKey]}
                                        onChange={(event) => onChange(index, priceKey, event.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        aria-label={`Discount for ${item.sku_snapshot}`}
                                        className="min-w-24"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.discount_amount}
                                        onChange={(event) =>
                                            onChange(index, 'discount_amount', event.target.value)
                                        }
                                    />
                                </td>
                                <td>{money(lineTotal(item))}</td>
                                <td>
                                    <Button
                                        variant="icon"
                                        className="text-red-700"
                                        aria-label="Remove item"
                                        onClick={() => onRemove(index)}
                                    >
                                        <Trash2 size={15} />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!items.length && (
                    <p className="p-6 text-center text-sm text-slate-400">
                        Search and add individual products to begin.
                    </p>
                )}
            </div>
        </>
    );
};
