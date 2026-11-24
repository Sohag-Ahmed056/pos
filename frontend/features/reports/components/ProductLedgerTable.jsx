import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectRole } from '../../auth/authSlice';
import { canReadDocument } from '../../auth/permissions';
import { DocumentDetailDialog } from '../../documents/components/DocumentDetailDialog';
import { statementValue } from '../model/statementFormat';
import { Pagination } from '../../../components/data/Pagination';

export const ProductLedgerTable = ({ result, page, onPageChange }) => {
    const role = useSelector(selectRole);
    const [view, setView] = useState(null);
    const columns = result.statement.columns;
    const cell = (row, column) => {
        const original = column.key === 'original_voucher';
        const resource = original ? row.original_resource : row.document_resource;
        const id = original ? row.original_id : row.document_id;
        const text = statementValue(row[column.key], column);
        return ['voucher', 'original_voucher'].includes(column.key) &&
            id &&
            canReadDocument(resource, role) ? (
            <button
                type="button"
                className="font-semibold text-pine underline decoration-dotted underline-offset-4"
                onClick={() => setView({ kind: resource, id })}
            >
                {text}
            </button>
        ) : (
            text
        );
    };
    return (
        <>
            <section
                className="overflow-hidden rounded-xl border bg-white"
                aria-label={result.statement.title}
            >
                <div className="border-b px-5 py-4">
                    <h3 className="font-semibold">{result.statement.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{result.note}</p>
                </div>
                <div className="overflow-x-auto">
                    <table
                        className="w-full min-w-[1250px] text-left text-xs"
                        aria-label="Product ledger transactions"
                    >
                        <thead className="border-b bg-slate-50 text-slate-600">
                            <tr>
                                {columns.map((column) => (
                                    <th key={column.key} className="px-3 py-4 font-semibold" scope="col">
                                        {column.title}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {result.rows.length ? (
                                result.rows.map((row) => (
                                    <tr
                                        key={`${row.type || row.movement_type}:${row.line_id || row.id}`}
                                        className="hover:bg-slate-50"
                                    >
                                        {columns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={`px-3 py-4 ${['money', 'cost', 'quantity'].includes(column.type) ? 'text-right font-mono tabular-nums' : ''}`}
                                            >
                                                {cell(row, column)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        className="px-5 py-10 text-center text-slate-500"
                                        colSpan={columns.length}
                                    >
                                        No posted activity matches these filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination meta={result.meta} page={page} onChange={onPageChange} />
            </section>
            {view && <DocumentDetailDialog kind={view.kind} id={view.id} onClose={() => setView(null)} />}
        </>
    );
};
