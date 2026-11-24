import {
    ledgerAmount,
    ledgerDate,
    ledgerTransaction,
    ledgerAmounts,
    ledgerPrintDate
} from '../model/ledgerFormat';

const Subtotal = ({ title, totals, grand = false }) => (
    <tr className={grand ? 'ledger-grand-total' : 'ledger-subtotal'}>
        <th colSpan={5} scope="row">
            {title}
        </th>
        {ledgerAmounts.map((column) => (
            <td key={column}>{ledgerAmount(totals[column])}</td>
        ))}
    </tr>
);
export const CustomerLedgerReport = ({ result, page }) => {
    const { layout, period, rows, meta } = result;
    const { company, heading, summaries } = layout;
    const printDate = ledgerPrintDate();
    return (
        <section className="panel overflow-x-auto" aria-label="Customer ledger accounts">
            <div className="customer-ledger-document">
                <header className="ledger-heading">
                    <h2>{company.name}</h2>
                    <p>Customer Ledger Accounts</p>
                    <p>
                        From {ledgerDate(period.from, true)} To {ledgerDate(period.to, true)}
                    </p>
                </header>
                <dl className="ledger-customer">
                    {[
                        ['Sales Channel', heading.channel],
                        ['Area', heading.area],
                        ['Party Name', heading.party],
                        ['Address', heading.address],
                        ['Customer Name', heading.customer]
                    ].map(([title, value]) => (
                        <div key={title}>
                            <dt>{title}</dt>
                            <span aria-hidden="true">:</span>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
                <table aria-label="Customer ledger transactions">
                    <colgroup>
                        {[50, 54, 54, 67, 117, 86, 72, 81, 68, 67, 95].map((width, index) => (
                            <col key={index} style={{ width: `${(width / 811) * 100}%` }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            {['GL Date', 'Voucher', 'Company', 'Transaction Type', 'Reference'].map(
                                (title) => (
                                    <th key={title} rowSpan={2} scope="col">
                                        {title}
                                    </th>
                                )
                            )}
                            <th colSpan={2} scope="colgroup">
                                Debit
                            </th>
                            <th colSpan={3} scope="colgroup">
                                Credit
                            </th>
                            <th rowSpan={2} scope="col">
                                Closing Balance
                            </th>
                        </tr>
                        <tr>
                            {['Sales', 'Adj', 'Collection', 'Return', 'Adj'].map((title, index) => (
                                <th key={index} scope="col">
                                    {title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length ? (
                            rows.map((row, index) => (
                                <tr key={index}>
                                    <td>{ledgerDate(row['GL Date'])}</td>
                                    <td>{row.Voucher}</td>
                                    <td>{company.code}</td>
                                    <td>{ledgerTransaction(row['Transaction Type'])}</td>
                                    <td>{row.Reference || ''}</td>
                                    {ledgerAmounts.map((column) => (
                                        <td key={column}>{ledgerAmount(row[column])}</td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={11}>No transactions in the selected period.</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        {Object.entries({
                            customer: 'Customer',
                            party: 'Party',
                            area: 'Area',
                            sales_channel: 'Sales Channel'
                        }).flatMap(([kind, title]) =>
                            summaries[kind].map((summary) => (
                                <Subtotal
                                    key={`${kind}-${summary.name}`}
                                    title={`${title} (${summary.name}) Sub Total:`}
                                    totals={summary.totals}
                                />
                            ))
                        )}
                        <Subtotal title="Grand Total:" totals={layout.totals} grand />
                    </tfoot>
                </table>
                <footer className="ledger-footer">
                    <span>Powered By IT-DEPARTMENT</span>
                    <span>
                        Page {page} of {Math.max(1, meta.pages)}
                    </span>
                    <span>Print Date: {printDate}</span>
                </footer>
            </div>
        </section>
    );
};
