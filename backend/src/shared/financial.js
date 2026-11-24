const Decimal = require('decimal.js');
const AppError = require('../app/error/AppError');
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const D = (value) => new Decimal(value === undefined || value === null ? 0 : String(value));
D.min = (...values) => Decimal.min(...values);
const money = (value) => D(value).toDecimalPlaces(2);
const cost = (value) => D(value).toDecimalPlaces(4);
const sum = (values) => values.reduce((a, b) => a.plus(b), D(0));
const assert = (condition, message, status = 422) => {
    if (!condition) throw new AppError(status, message);
};
const lineAmount = (item) =>
    money(
        D(item.quantity_pcs)
            .times(item.unit_price ?? item.unit_cost)
            .minus(item.discount_amount || 0)
    );
const balanced = (lines) => {
    assert(
        lines.every((l) => D(l.debit).gte(0) && D(l.credit).gte(0)),
        'Journal values must be nonnegative'
    );
    const effective = lines.filter((l) => D(l.debit).gt(0) || D(l.credit).gt(0));
    assert(
        effective.every(
            (l) => D(l.debit).gte(0) && D(l.credit).gte(0) && !(D(l.debit).gt(0) && D(l.credit).gt(0))
        ),
        'Invalid journal line'
    );
    assert(
        sum(effective.map((l) => money(l.debit))).eq(sum(effective.map((l) => money(l.credit)))),
        'Journal must balance'
    );
    return effective;
};
// A proportional difference gives the final partial receipt/return the remaining cent.
const proportional = (total, quantity, before, count) => {
    return money(D(total).times(D(before).plus(count)).div(quantity)).minus(
        money(D(total).times(before).div(quantity))
    );
};
module.exports = { D, money, cost, sum, assert, lineAmount, balanced, proportional };
