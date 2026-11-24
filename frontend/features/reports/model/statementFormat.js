import Decimal from 'decimal.js';
import { ledgerAmount, ledgerDate, ledgerTransaction } from './ledgerFormat.js';

export const statementValue = (value, column) => {
    if (value === undefined || value === null || value === '') return '';
    if (column.type === 'date') return ledgerDate(value);
    if (column.type === 'datetime') return `${ledgerDate(value)} ${String(value).slice(11, 19)}`;
    if (column.type === 'money') return ledgerAmount(value);
    if (column.type === 'quantity' || column.type === 'cost') {
        const [integer, fraction] = new Decimal(value).toFixed(column.type === 'quantity' ? 0 : 4).split('.');
        return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
    }
    return column.type === 'transaction' ? ledgerTransaction(value).replaceAll('_', ' ') : String(value);
};
export const statementBands = (columns) =>
    columns.reduce((bands, column, index) => {
        const previous = bands.at(-1);
        if (column.group && previous?.group === column.group) previous.span++;
        else bands.push({ title: column.group || column.title, group: column.group, start: index, span: 1 });
        return bands;
    }, []);
