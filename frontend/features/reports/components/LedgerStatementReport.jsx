import { Fragment } from 'react';
import { ledgerDate, ledgerPrintDate } from '../model/ledgerFormat';
import { statementValue, statementBands } from '../model/statementFormat';

const StatementTable = ({ statement, section, rows }) => {
    const columns = statement.columns,
        bands = statementBands(columns),
        grouped = columns.some((column) => column.group);
    const firstAmount = columns.findIndex((column) => statement.metrics.includes(column.key));
    const width = columns.reduce((sum, column) => sum + column.width, 0);
    return (
        <>
            <dl className="ledger-customer ledger-statement-details">
                {section.details.map(([title, value]) => (
                    <div key={title}>
                        <dt>{title}</dt>
                        <span aria-hidden="true">:</span>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
            <table aria-label={`${statement.title} transactions`}>
                <colgroup>
                    {columns.map((column) => (
                        <col key={column.key} style={{ width: `${(column.width / width) * 100}%` }} />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        {bands.map((band) => (
                            <th
                                key={band.start}
                                colSpan={band.span}
                                rowSpan={band.group ? 1 : grouped ? 2 : 1}
                                scope={band.group ? 'colgroup' : 'col'}
                            >
                                {band.title}
                            </th>
                        ))}
                    </tr>
                    {grouped && (
                        <tr>
                            {columns
                                .filter((column) => column.group)
                                .map((column) => (
                                    <th key={column.key} scope="col">
                                        {column.title}
                                    </th>
                                ))}
                        </tr>
                    )}
                </thead>
                <tbody>
                    {section.indexes.length ? (
                        section.indexes.map((index) => (
                            <tr key={index}>
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={
                                            ['money', 'cost', 'quantity'].includes(column.type)
                                                ? 'ledger-number'
                                                : undefined
                                        }
                                    >
                                        {statementValue(rows[index][column.key], column)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length}>No transactions in the selected period.</td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    {section.trailers.map((trailer) => (
                        <tr key={trailer.label}>
                            <th colSpan={firstAmount} scope="row">
                                {trailer.label}
                            </th>
                            {columns.slice(firstAmount).map((column) => (
                                <td key={column.key}>{statementValue(trailer.totals[column.key], column)}</td>
                            ))}
                        </tr>
                    ))}
                </tfoot>
            </table>
        </>
    );
};
export const LedgerStatementReport = ({ result, page }) => {
    const { statement, rows, period, meta } = result;
    const visible = statement.sections.filter(
        (section) => section.indexes.length || section.activityCount === 0
    );
    const sections = visible.length
        ? visible
        : [{ id: 'empty', details: statement.details, indexes: [], trailers: [] }];
    return (
        <section className="panel overflow-x-auto" aria-label={statement.title}>
            <div className="customer-ledger-document ledger-statement-document">
                <header className="ledger-heading">
                    <h2>{statement.company.name}</h2>
                    <p>{statement.title}</p>
                    <p>
                        From {ledgerDate(period.from, true)} To {ledgerDate(period.to, true)}
                    </p>
                </header>
                {sections.map((section, index) => (
                    <Fragment key={section.id}>
                        {index > 0 && <div className="ledger-section-space" />}
                        <StatementTable statement={statement} section={section} rows={rows} />
                    </Fragment>
                ))}
                <table className="ledger-statement-grand" aria-label="Full report totals">
                    <tbody>
                        <tr>
                            <th scope="row">{statement.totalLabel}</th>
                            {statement.columns
                                .filter((column) => statement.metrics.includes(column.key))
                                .map((column) => (
                                    <td key={column.key} className="ledger-number">
                                        <span>
                                            {column.group ? `${column.group} · ` : ''}
                                            {column.title}
                                        </span>
                                        <strong>
                                            {statementValue(statement.totals[column.key], column)}
                                        </strong>
                                    </td>
                                ))}
                        </tr>
                    </tbody>
                </table>
                <p className="ledger-statement-note">
                    {statement.note} Subtotals and totals cover the entire filtered report.
                </p>
                <footer className="ledger-footer">
                    <span>Powered By IT-DEPARTMENT</span>
                    <span>
                        Page {page} of {Math.max(1, meta.pages)}
                    </span>
                    <span>Print Date: {ledgerPrintDate()}</span>
                </footer>
            </div>
        </section>
    );
};
