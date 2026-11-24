const test = require('node:test');
const assert = require('node:assert/strict');
const { D, money, cost, balanced, proportional } = require('../src/shared/financial');
test('money remains exact across decimal input and large balances', () => {
    assert.equal(money(D('0.1').plus('0.2')).toFixed(2), '0.30');
    assert.equal(money(D('999999999999.99').plus('0.01')).toFixed(2), '1000000000000.00');
    assert.equal(cost('12.34565').toFixed(4), '12.3457');
});
test('partial monetary allocations preserve the final cent', () => {
    const total = D('10.00');
    const amounts = [0, 1, 2].map((n) => proportional(total, 3, n, 1));
    assert.equal(amounts.reduce((a, b) => a.plus(b), D(0)).toFixed(2), '10.00');
    assert.deepEqual(
        amounts.map((a) => a.toFixed(2)),
        ['3.33', '3.34', '3.33']
    );
});
test('unbalanced or negative journals cannot be posted', () => {
    assert.throws(() => balanced([{ debit: '10' }, { credit: '9.99' }]), /balance/);
    assert.throws(() => balanced([{ debit: '-1' }, { credit: '-1' }]), /nonnegative/);
    assert.throws(() => balanced([{ debit: 1, credit: 1 }]), /Invalid/);
    assert.equal(balanced([{ debit: 10 }, { credit: 10 }, { debit: 0, credit: 0 }]).length, 2);
});
