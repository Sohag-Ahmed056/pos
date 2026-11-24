import { AlertCircle } from 'lucide-react';
import { errorText } from '../../lib/errors';
export const ErrorBox = ({ error }) => {
    return (
        <div
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
            <AlertCircle size={18} />
            {errorText(error)}
        </div>
    );
};
