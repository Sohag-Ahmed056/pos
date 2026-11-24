const { spawnSync } = require('child_process');
for (const file of [
    'tests/financial.test.js',
    'tests/validation.test.js',
    'tests/transaction.test.js',
    'tests/features.test.js',
    'tests/customerLedger.test.js',
    'tests/ledgerStatement.test.js',
    'tests/productLedger.test.js'
]) {
    const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
    if (r.status) process.exit(r.status);
}
