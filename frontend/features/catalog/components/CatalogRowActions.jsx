import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
export const CatalogRowActions = ({ row, profile, writable, deletable, onProfile, onEdit, onDelete }) => {
    return (
        <>
            {profile && (
                <Button variant="icon" onClick={() => onProfile(row)} aria-label="View profile">
                    <Eye size={15} />
                </Button>
            )}
            {writable && (
                <Button variant="icon" onClick={() => onEdit(row)} aria-label="Edit record">
                    <Pencil size={15} />
                </Button>
            )}
            {deletable && (
                <Button
                    variant="icon"
                    className="text-red-700"
                    onClick={() => onDelete(row)}
                    aria-label="Delete record"
                >
                    <Trash2 size={15} />
                </Button>
            )}
        </>
    );
};
