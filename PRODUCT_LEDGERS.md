# Product-wise ledgers

The three reports use the existing MySQL pool, existing tables, and read-only consistent snapshots. They do not change stock, posted documents, journals, financial ledger APIs, or financial ledger rendering/export code. No schema changes, tables, views, dependencies, or ORM were introduced.

## Where to find them

- **Customers → View profile → Product-wise Sales Ledger**. Information, the unchanged Financial Ledger, Invoice History, and Payment History have separate tabs.
- **Suppliers → View profile → Product-wise Purchase Ledger**. The supplier Financial Ledger, Purchase History, and authorized Payment History remain separate.
- **Inventory → Product Ledger** (`/inventory/product-ledger`). Search a product by name or SKU, then choose stock movements, purchases/GRNs, sales, or either return history. Product profiles also link to this page.

Voucher links open the existing document detail dialog, subject to the existing document read permissions. Reports support product, dates, voucher/reference, literal text search, server pagination, full-filter totals, print, PDF, and Excel. The standalone report also supports warehouse, movement type, customer, and supplier filters.

## Accounting and quantity rules

- Customer rows include only posted invoices and posted returns against posted invoices. They retain original product/SKU snapshots and selling rates. Invoice discounts are allocated with the existing cumulative rounded rule before filtering products. Return values use cumulative original-line quantities in posting order, preserving rounding cents. Damaged returns reverse sales value/quantities but create no stock-in movement.
- Supplier orders are distinct `ORDER` rows with **zero received quantities/value**. Confirmed/closed order quantities and order values are reported separately, once per order line. Only posted GRNs and returns affect received PCS/value. Partial receipts use the stored GRN line amounts; purchase returns use the exact cumulative original receipt basis. Purchase voucher searches follow associated receipts and returns.
- Financial dues and payment allocations stay in the existing financial ledgers. Neither product report allocates customer/supplier payments to products.
- Stock movement times and stock date filters use **UTC posting time (`stock_movements.occurred_at`)**. Purchase/sales history tabs and party product reports use the corresponding document's business date. A backdated invoice can therefore have a different business date and stock posting date.
- Physical opening/running/closing stock includes all valid posted movements for the selected product/warehouse. Opening includes movements before the start date. Running order is posting timestamp then movement ID. Party, type, voucher and search filters apply **after** physical running balances are calculated. Visible movement totals are explicitly separate from physical scope totals. Pagination does not reset balances or totals.
- Historical book valuation uses outgoing movement average costs as historical anchors, then replays subsequent incoming quantities with the original four-decimal weighted average and two-decimal valuation rule. It never substitutes today's price/cost. All-time PCS reconcile with `inventory_balances`; warehouse and current book values are also shown.
- The stock table labels historical inventory unit cost, original selling rate and signed movement cost separately. Signed movement cost means quantity × historical inventory unit cost, **not revenue or exact booked COGS**. Sales revenue appears in the separate sales history.
- **Profitability limitation:** per-line booked COGS is not stored. Weighted-cost book rounding can differ from quantity × stored unit cost. The report explicitly explains this limitation and does not display an estimated gross profit/margin. Existing general financial profit/loss reporting is unchanged.

## APIs and permissions

| GET operation | Roles |
| --- | --- |
| `/api/v1/product-ledgers/customers/:id` | Admin, Manager, Accountant, Cashier |
| `/api/v1/product-ledgers/suppliers/:id` | Admin, Manager, Accountant, Purchase |
| `/api/v1/product-ledgers/products/:id` | Admin, Manager, Accountant, Purchase, Warehouse |

Standalone `section` values are `movements` (default), `purchases`, `sales`, `sales-returns`, and `purchase-returns`. Purchase/Warehouse cannot read standalone sales history; Warehouse cannot read purchase return details. The UI uses existing document permissions for tabs and voucher dialogs.

Filters: `from`, `to`, `product_id`, `warehouse_id`, `customer_id`, `supplier_id`, `type`, `voucher`, `search`, `page`, `limit` (1–100). The party/product path always determines the selected record. Blank dates mean all history. `format=pdf|print|xlsx` exports the whole matching report, including totals and supplementary product/warehouse summaries, irrespective of the displayed page. Exports exceeding 50,000 rows require narrower filters. Excel also records the report scope and valuation/profitability notes.

All SQL values use mysql2 parameter binding. Reporting CTEs use `query(sql, values)` because repeated prepared window/UNION CTE executions on this MySQL 8.0.45 instance reproduced incorrect pushed predicates. Tests repeat filters/pages to prevent recurrence. Product sales queries first restrict eligible invoices with the existing product index, retaining all invoice lines within discount windows. Stock queries use the existing product/warehouse/time index; query count does not grow with displayed row count.

## Verification

```sh
npm test
npm run check
npm run build
npm run test:integration
```

Integration tests create and remove a uniquely named disposable database cloned from the existing schema. Tests cover isolation, discounts, rounding-sensitive returns, damaged returns, partial/draft GRNs, every supported movement type, historical/current valuations, warehouse/date/party filters, full-scope pagination, role permissions, Excel/PDF responses, profile tabs, voucher dialogs, and existing transactional/accounting workflows.

Before implementation, financial source hashes and real customer/supplier JSON outputs were captured. `backend/tests/financialLedger.baseline.json` protects the unchanged financial modules and frontend components. Integration tests compare complete financial outputs before/after new report reads. Read-only verification also compared the original real-data JSON baselines and checked all existing product stock/valuation and customer/supplier totals.

Optional read-only live verification and preview generation:

```sh
node backend/scripts/verifyProductLedgers.js
```

This creates PDF/Excel/JSON previews under `backend/artifacts` and checks that journal/stock/audit counts and journal totals stay unchanged. To compare an earlier saved financial JSON baseline, provide its directory in `POS_LEDGER_BASELINE`.
