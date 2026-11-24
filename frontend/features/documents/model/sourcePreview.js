import Decimal from 'decimal.js';
const money = (value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const sourceLinePreview = (item) => {
    const original = Number(item.source_quantity_pcs);
    const count = Number(item.quantity_pcs || 0);
    const before = Number(item.returned_pcs || item.received_pcs || 0);
    const remaining = Number(item.remaining_pcs);
    if (
        !Number.isInteger(original) ||
        original < 1 ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > remaining
    )
        return { valid: false, amount: null, rate: item.return_unit_rate || '0.0000' };
    const basis = new Decimal(item.return_basis_amount ?? item.source_line_amount ?? 0);
    const amount = money(basis.times(before + count).div(original)).minus(
        money(basis.times(before).div(original))
    );
    return {
        valid: true,
        amount: amount.toFixed(2),
        rate: basis.div(original).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
    };
};
export const sourceTotalPreview = (items) => {
    const previews = items.map(sourceLinePreview);
    return previews.every((row) => row.valid)
        ? previews.reduce((total, row) => total.plus(row.amount), new Decimal(0)).toFixed(2)
        : null;
};
