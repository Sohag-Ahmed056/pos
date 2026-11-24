import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { selectRole } from '../../auth/authSlice';
import { reportDefinitions, reportRestrictions } from '../config/reportDefinitions';
import { initialReportFilters, reportFilters } from '../model/reportFilters';
import { useGetReportQuery } from '../reportsApi';
export const useReportController = () => {
    const [params, setParams] = useSearchParams();
    const role = useSelector(selectRole);
    const allowed = reportDefinitions.filter(
        ([name]) => !reportRestrictions[role] || reportRestrictions[role].includes(name)
    );
    const requested = params.get('report');
    const report = allowed.some(([name]) => name === requested) ? requested : allowed[0][0];
    const [form, setForm] = useState(() => initialReportFilters(params)),
        [page, setPage] = useState(1),
        [group, setGroup] = useState('customer');
    const locationKey = params.toString();
    useEffect(() => {
        setForm(initialReportFilters(new URLSearchParams(locationKey)));
        setPage(1);
    }, [locationKey]);
    const applied = reportFilters(report, initialReportFilters(params));
    const query = useGetReportQuery({ name: report, filters: { ...applied, page } });
    const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
    const selectReport = (name) => {
        setParams({ report: name, ...reportFilters(name, { from: form.from, to: form.to }) });
    };
    const apply = (event) => {
        event.preventDefault();
        setPage(1);
        setParams({ report, ...reportFilters(report, form) });
    };
    return {
        ...query,
        result: query.currentData?.data,
        isLoading: query.isLoading || (query.isFetching && !query.currentData),
        allowed,
        report,
        form,
        setField,
        selectReport,
        apply,
        applied,
        page,
        setPage,
        group,
        setGroup
    };
};
