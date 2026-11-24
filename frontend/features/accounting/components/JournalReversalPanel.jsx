import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
export const JournalReversalPanel = ({ onReverse }) => {
    const [id, setId] = useState('');
    return (
        <section className="panel mb-6 p-5">
            <h2 className="mb-2 font-semibold">Reverse an authorized journal</h2>
            <p className="mb-4 text-xs text-slate-500">
                Opening balances, manual adjustments, and expenses can be reversed by journal ID. Sales and
                purchase corrections use their return workflows.
            </p>
            <div className="flex flex-wrap gap-3">
                <input
                    className="max-w-xs"
                    placeholder="Original journal ID"
                    aria-label="Original journal ID"
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    inputMode="numeric"
                />
                <Button variant="secondary" disabled={!/^[1-9]\d*$/.test(id)} onClick={() => onReverse(id)}>
                    <RotateCcw size={15} />
                    Prepare reversal
                </Button>
            </div>
        </section>
    );
};
