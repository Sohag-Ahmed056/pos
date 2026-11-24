import { Eye, Pencil, Check } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
export const DocumentRowActions = ({ row, writable, postable, onView, onEdit, onPost }) => {
    return (
        <>
            <Button variant="icon" aria-label="View transaction" onClick={() => onView(row.id)}>
                <Eye size={15} />
            </Button>
            {row.status === 'DRAFT' && writable && (
                <Button variant="icon" aria-label="Edit draft" onClick={() => onEdit(row)}>
                    <Pencil size={15} />
                </Button>
            )}
            {row.status === 'DRAFT' && postable && (
                <Button
                    variant="icon"
                    className="text-pine"
                    aria-label="Post transaction"
                    onClick={() => onPost(row)}
                >
                    <Check size={16} />
                </Button>
            )}
        </>
    );
};
