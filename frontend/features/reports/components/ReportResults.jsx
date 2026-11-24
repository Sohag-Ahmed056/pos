import { Panel } from '../../../components/layout/Panel';
import { DataTable } from '../../../components/data/DataTable';
import { Pagination } from '../../../components/data/Pagination';
import { money } from '../../../lib/format';
import { reportDefinitions } from '../config/reportDefinitions';
import { isPartyLedger } from '../model/reportFilters';
import { ReportTotals } from './ReportTotals';
import { GroupSubtotals } from './GroupSubtotals';
import { ReconciliationCards } from './ReconciliationCards';
import { ExpenseSummary } from './ExpenseSummary';
import { CustomerLedgerReport } from './CustomerLedgerReport';
import { LedgerStatementReport } from './LedgerStatementReport';
export const ReportResults = ({ report, result, page, onPageChange, group, onGroupChange }) => {
    if (report === 'reconciliation') return <ReconciliationCards result={result} />;
    if (result?.statement)
        return (
            <>
                {result.totals && <ReportTotals totals={result.totals} />}
                <LedgerStatementReport result={result} page={page} />
                <Pagination meta={result.meta} page={page} onChange={onPageChange} />
            </>
        );
    if (report === 'customer-ledger' && result?.layout)
        return (
            <>
                <ReportTotals totals={result.totals} />
                <CustomerLedgerReport result={result} page={page} />
                <Pagination meta={result.meta} page={page} onChange={onPageChange} />
                <GroupSubtotals subtotals={result.subtotals} group={group} onGroupChange={onGroupChange} />
            </>
        );
    const net =
        report === 'profit-loss' && result?.rows
            ? result.rows.reduce((sum, row) => sum + Number(row.credit) - Number(row.debit), 0)
            : null;
    return (
        <>
            {result?.totals && <ReportTotals totals={result.totals} />}{' '}
            {result?.summary && <ExpenseSummary summary={result.summary} />}
            {net !== null && (
                <p className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-pine">
                    Net result on this page: <strong>৳ {money(net)}</strong>
                </p>
            )}
            <Panel
                title={reportDefinitions.find(([name]) => name === report)?.[1]}
                description={
                    isPartyLedger(report)
                        ? 'Stable order by GL date, journal, and line. Opening and running balances use posted journals.'
                        : 'Amounts in BDT · Whole PCS quantities'
                }
                action={<span className="text-xs text-slate-400">{result?.meta?.total || 0} rows</span>}
                footer={<Pagination meta={result?.meta} page={page} onChange={onPageChange} />}
            >
                <DataTable columns={result?.columns || []} rows={result?.rows} />
            </Panel>
            {result?.subtotals && (
                <GroupSubtotals subtotals={result.subtotals} group={group} onGroupChange={onGroupChange} />
            )}
        </>
    );
};
