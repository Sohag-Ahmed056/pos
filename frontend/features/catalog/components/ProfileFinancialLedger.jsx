import { useState } from 'react';
import { DateRangeFilter } from '../../../components/data/DateRangeFilter';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { useGetReportQuery } from '../../reports/reportsApi';
import { ReportResults } from '../../reports/components/ReportResults';
import { ReportExportActions } from '../../reports/components/ReportExportActions';

// Embed the existing report and export components unchanged. No product rows are injected.
export const ProfileFinancialLedger = ({ party, id }) => {
    const [period, setPeriod] = useState({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [group, setGroup] = useState('customer');
    const report = `${party}-ledger`;
    const filters = { ...period, [`${party}_id`]: id };
    const { currentData, error, isFetching } = useGetReportQuery({
        name: report,
        filters: { ...filters, page, limit: 20 }
    });
    return (
        <div className="space-y-5">
            <DateRangeFilter
                value={period}
                optional
                onApply={(next) => {
                    setPeriod(next);
                    setPage(1);
                }}
            />
            <ReportExportActions name={report} filters={filters} />
            {error ? (
                <ErrorBox error={error} />
            ) : !currentData || isFetching ? (
                <Loading />
            ) : (
                <ReportResults
                    report={report}
                    result={currentData.data}
                    page={page}
                    onPageChange={setPage}
                    group={group}
                    onGroupChange={setGroup}
                />
            )}
        </div>
    );
};
