import { Trash2 } from 'lucide-react';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { money } from '../../../lib/format';
export const JournalLinesEditor = ({ lines, options, onChange, onAdd, onRemove, totals }) => {
    return (
        <>
            <div className="mt-6 space-y-3">
                {lines.map((line, index) => (
                    <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]" key={index}>
                        <Field
                            title="Account"
                            required
                            options={options}
                            value={line.account_id}
                            onChange={(value) => onChange(index, 'account_id', value)}
                        />
                        <Field
                            title="Debit · BDT"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.debit}
                            onChange={(value) => onChange(index, 'debit', value)}
                        />
                        <Field
                            title="Credit · BDT"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.credit}
                            onChange={(value) => onChange(index, 'credit', value)}
                        />
                        <Button
                            variant="icon"
                            className="h-10"
                            aria-label="Remove journal line"
                            disabled={lines.length <= 2}
                            onClick={() => onRemove(index)}
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button variant="secondary" onClick={onAdd}>
                    + Add line
                </Button>
                <p className="text-sm">
                    Debit {money(totals.debit)} · Credit {money(totals.credit)}
                </p>
            </div>
        </>
    );
};
