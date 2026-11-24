import { money } from '../../../../lib/format';
export const PaymentAllocationsTable = ({ rows, amounts, onChange }) => {
    return (
        <div className="overflow-x-auto">
            <table>
                <thead>
                    <tr>
                        <th>Document</th>
                        <th>Outstanding · BDT</th>
                        <th>Allocate · BDT</th>
                    </tr>
                </thead>
                <tbody>
                    {rows
                        ?.filter((row) => Number(row.outstanding) > 0 || amounts[row.id])
                        .map((row) => (
                            <tr key={row.id}>
                                <td>{row.document_no}</td>
                                <td>{money(row.outstanding)}</td>
                                <td>
                                    <input
                                        aria-label={`Allocation to ${row.document_no}`}
                                        type="number"
                                        min="0"
                                        max={row.outstanding}
                                        step="0.01"
                                        value={amounts[row.id] || ''}
                                        onChange={(event) => onChange(row.id, event.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
};
