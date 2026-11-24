import Decimal from 'decimal.js';
export const emptyJournalLine = () => ({ account_id: '', debit: '', credit: '' });
export const journalPayload = ({ form, lines, accounts, customer, supplier }) => {
    return {
        ...form,
        reference_no: form.reference_no || null,
        lines: lines.map((line) => {
            const code = accounts.find((account) => String(account.id) === String(line.account_id))?.code;
            return {
                ...line,
                debit: String(line.debit || 0),
                credit: String(line.credit || 0),
                ...(code === 'AR'
                    ? { customer_id: customer }
                    : code === 'AP'
                      ? { supplier_id: supplier }
                      : {})
            };
        })
    };
};
export const journalTotals = (lines) => {
    return {
        debit: lines.reduce((total, line) => total.plus(line.debit || 0), new Decimal(0)).toFixed(2),
        credit: lines.reduce((total, line) => total.plus(line.credit || 0), new Decimal(0)).toFixed(2)
    };
};
