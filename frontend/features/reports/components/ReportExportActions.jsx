import { Download, Printer } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { reportFileUrl } from '../reportsApi';
import { useReportExport } from '../hooks/useReportExport';
export const ReportExportActions = ({ name, filters }) => {
    const { download, isLoading } = useReportExport(name, filters);
    return (
        <div className="flex flex-wrap gap-2">
            <Button
                as="a"
                variant="secondary"
                href={reportFileUrl(name, filters, 'print')}
                target="_blank"
                rel="noreferrer"
            >
                <Printer size={16} />
                Print report
            </Button>
            <Button as="a" variant="secondary" href={reportFileUrl(name, filters, 'pdf')}>
                <Download size={16} />
                PDF
            </Button>
            <Button onClick={download} disabled={isLoading}>
                <Download size={16} />
                {isLoading ? 'Exporting…' : 'Excel export'}
            </Button>
        </div>
    );
};
