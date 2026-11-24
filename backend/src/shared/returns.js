const { D, money, cost, sum, lineAmount } = require('./financial');

// Assign invoice discounts by cumulative differences so the last line receives
// any rounding cent. Preview data and posting use the same original line basis.
const returnBases = (items, sale, discount = 0) => {
    let offset = D(0);
    const net = sale ? sum(items.map(lineAmount)) : D(0);
    return items.map((row) => {
        let amount;
        if (sale) {
            const before = net.eq(0) ? D(0) : money(D(discount).times(offset).div(net));
            offset = offset.plus(lineAmount(row));
            const after = net.eq(0) ? D(0) : money(D(discount).times(offset).div(net));
            amount = lineAmount(row).minus(after.minus(before));
        } else amount = money(row.line_amount);
        return {
            ...row,
            return_basis_amount: amount.toFixed(2),
            return_unit_rate: cost(amount.div(row.quantity_pcs)).toFixed(4)
        };
    });
};
module.exports = { returnBases };
