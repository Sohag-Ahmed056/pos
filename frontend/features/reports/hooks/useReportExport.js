import { useExportReportMutation } from '../reportsApi';
import { downloadFile } from '../../../lib/download';
import { errorText } from '../../../lib/errors';
import { useToast } from '../../../components/ui/ToastProvider';
export const useReportExport = (name, filters) => {
    const [exportReport, { isLoading }] = useExportReportMutation();
    const toast = useToast();
    const download = async () => {
        try {
            const url = await exportReport({ name, filters, format: 'xlsx' }).unwrap();
            downloadFile(url, `${name}.xlsx`);
        } catch (error) {
            toast(errorText(error), true);
        }
    };
    return { download, isLoading };
};
