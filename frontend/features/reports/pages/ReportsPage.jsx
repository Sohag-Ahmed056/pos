import { PageHeader } from '../../../components/layout/PageHeader';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Loading } from '../../../components/ui/Loading';
import { useReportController } from '../hooks/useReportController';
import { ReportExportActions } from '../components/ReportExportActions';
import { ReportFilters } from '../components/ReportFilters';
import { ReportResults } from '../components/ReportResults';
const ReportsPage = () => {
    const report = useReportController();
    return (
        <>
            <PageHeader
                eyebrow="BUSINESS INSIGHTS"
                title="Reports & ledgers"
                description="Trace your business activity back to posted transactions."
            >
                {report.report !== 'reconciliation' && (
                    <ReportExportActions name={report.report} filters={report.applied} />
                )}
            </PageHeader>
            <ReportFilters
                report={report.report}
                options={report.allowed}
                form={report.form}
                onChange={report.setField}
                onReportChange={report.selectReport}
                onSubmit={report.apply}
                busy={report.isFetching}
            />
            {report.error ? (
                <ErrorBox error={report.error} />
            ) : report.isLoading ? (
                <Loading />
            ) : (
                <ReportResults
                    report={report.report}
                    result={report.result}
                    page={report.page}
                    onPageChange={report.setPage}
                    group={report.group}
                    onGroupChange={report.setGroup}
                />
            )}
        </>
    );
};

export default ReportsPage;
