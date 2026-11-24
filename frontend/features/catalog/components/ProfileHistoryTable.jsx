import { DataTable } from '../../../components/data/DataTable';
import { Pagination } from '../../../components/data/Pagination';
import { SearchInput } from '../../../components/data/SearchInput';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Button } from '../../../components/ui/Button';
export const ProfileHistoryTable = ({ title, query, columns, page, setPage, search, setSearch, onView }) => {
    const data = query.currentData;
    return (
        <section className="mt-6 rounded-lg border" aria-label={title}>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <h3 className="font-semibold">{title}</h3>
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    label={`Search ${title.toLowerCase()}`}
                    placeholder="Search history…"
                />
            </div>
            {query.error ? (
                <ErrorBox error={query.error} />
            ) : query.isFetching && !data ? (
                <Loading />
            ) : (
                <DataTable
                    columns={columns}
                    rows={data?.data}
                    actions={
                        onView
                            ? (row) =>
                                  onView.canView(row) && (
                                      <Button variant="secondary" onClick={() => onView.open(row)}>
                                          View transaction
                                      </Button>
                                  )
                            : undefined
                    }
                />
            )}
            <Pagination meta={data?.meta} page={page} onChange={setPage} />
        </section>
    );
};
