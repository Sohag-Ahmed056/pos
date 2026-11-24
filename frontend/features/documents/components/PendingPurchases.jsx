import { useEffect, useState } from 'react';
import { useGetPendingPurchasesQuery } from '../documentsApi';
import { useDebounce } from '../../../hooks/useDebounce';
import { Panel } from '../../../components/layout/Panel';
import { DataTable } from '../../../components/data/DataTable';
import { Pagination } from '../../../components/data/Pagination';
import { SearchInput } from '../../../components/data/SearchInput';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { money } from '../../../lib/format';
export const PendingPurchases = ({ onReceive }) => {
    const [search, setSearch] = useState(''),
        [page, setPage] = useState(1);
    const debounced = useDebounce(search);
    useEffect(() => setPage(1), [debounced]);
    const query = useGetPendingPurchasesQuery({ page, search: debounced });
    return (
        <Panel
            title="Purchases awaiting goods"
            description="Confirmed orders with quantities still to receive."
            footer={<Pagination meta={query.currentData?.meta} page={page} onChange={setPage} />}
        >
            <div className="p-4">
                <SearchInput
                    label="Search pending purchases"
                    placeholder="Search order, supplier, or reference…"
                    value={search}
                    onChange={setSearch}
                />
            </div>
            {query.error ? (
                <ErrorBox error={query.error} />
            ) : query.isFetching && !query.currentData ? (
                <Loading />
            ) : (
                <DataTable
                    rows={query.currentData?.data}
                    columns={[
                        'purchase_no',
                        'purchase_date',
                        'supplier',
                        'warehouse',
                        'remaining_pcs',
                        { key: 'remaining_amount', title: 'Pending value · BDT', render: money }
                    ]}
                    actions={
                        onReceive
                            ? (row) => (
                                  <Button variant="secondary" onClick={() => onReceive(row.id)}>
                                      Receive goods
                                  </Button>
                              )
                            : undefined
                    }
                />
            )}
        </Panel>
    );
};
