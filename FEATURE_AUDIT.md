# Feature completion report — Lean Professional POS v1.0

Updated: 2026-10-25. This supersedes the earlier audit findings for the supplied feature/workflow specification.

**The eight identified gaps are completed and verified.** The existing purchase, inventory, sales, settlement, return, accounting, and Walton-ledger workflows remain in place. The implementation continues to use Express, parameterized MySQL queries, the existing connection pool, atomic transactions, and row locks. No ORM, schema migration, SQL view, or production-data reset was introduced.

## Completed findings

| ID | Feature | Completed behavior | Main files |
| --- | --- | --- | --- |
| F01 | Document permissions | Lists and details enforce explicit reader roles. Frontend document navigation uses the corresponding read policy; creation/posting roles remain separate. Unauthorized Cashier requests for payments, expenses, purchases, and audit history are rejected. | [Backend policy](backend/src/shared/permissions.js), [routes](backend/src/modules/operations/operations.route.js), [frontend policy](frontend/features/auth/permissions.js), [navigation](frontend/app/navigation.js) |
| F02 | Dashboard dates and today's collection | Bangladesh-time today's collection; selected-period goods received, collections, supplier payments, expenses, gross/net profit, sales chart, and recent activity. Today/month sales retain their stated time scopes. Current stock and AR/AP are clearly identified as current balances. Date filters are applied through the URL and API. | [Report SQL](backend/src/modules/reports/reports.service.js), [dashboard](frontend/features/dashboard/pages/DashboardPage.jsx), [date control](frontend/components/data/DateRangeFilter.jsx) |
| F03 | Audit history | Admin/Manager audit screen and read-only API, search, user/action/record/date filters, pagination, detail inspection, and refresh. Credentials/session identifiers are removed from returned details. Self-service password change and its audit event commit atomically; failed changes roll back. | [Audit service](backend/src/modules/reports/audit.service.js), [password changes](backend/src/modules/auth/auth.service.js), [audit feature](frontend/features/audit/pages/AuditPage.jsx) |
| F04 | Purchase details and print | Original line amounts, subtotal, discounts, purchase total, ordered/received/pending PCS, supplier reference, and warehouse name. Printing uses an isolated document portal and A4 layout with wrapped columns and repeated table headers. The actual PDF was generated and visually inspected. | [Document service](backend/src/modules/operations/operations.service.js), [voucher](frontend/features/documents/components/detail/VoucherDocument.jsx), [print portal](frontend/features/documents/components/DocumentDetailDialog.jsx), [print CSS](frontend/styles.css) |
| F05 | Complete profile histories | Search, date filters, counts, pagination, separate payment pagination, product movement/purchase/sales tabs, and authorized original-document drilldowns. All pages remain available; the old first-page/ten-payment ceiling is removed. Payment detail visibility respects the reader policy. | [History SQL](backend/src/modules/catalog/catalog.history.js), [profile hook](frontend/features/catalog/hooks/useCatalogProfile.js), [profile](frontend/features/catalog/components/CatalogProfile.jsx), [history table](frontend/features/catalog/components/ProfileHistoryTable.jsx) |
| F06 | Expense summaries | Full-filter totals and grouping by expense name, independent of the current detail page. Supports date, expense-name, and payment-account filters. Expense postings and reversals use their accounting dates, so a later reversal does not erase an earlier period's expense. Includes summary display and exports. | [Report service](backend/src/modules/reports/reports.service.js), [expense summary](frontend/features/reports/components/ExpenseSummary.jsx), [filters](frontend/features/reports/components/ReportFilters.jsx) |
| F07 | Excel grand totals | Explicit Grand totals worksheet containing period and whole-report totals, while retaining the eleven customer-ledger columns. Group-subtotal sheets remain available; expense reports also include an Expense summary worksheet. Empty results remain exportable. PDF totals have explicit metric labels. | [Export controller](backend/src/modules/reports/reports.controller.js), [export tests](backend/tests/features.test.js) |
| F08 | Return price and amount previews | Original net rate/cost and live line/overall return amount, including original discounts and cumulative rounding. Fractional/excess PCS are rejected. Preview source bases and posting share the same backend calculation; final amounts remain validated under the posting transaction. GRN receiving also has a monetary preview. | [Return bases](backend/src/shared/returns.js), [source model](frontend/features/documents/model/sourcePreview.js), [source table](frontend/features/documents/components/editor/SourceItemsTable.jsx) |

## Additional workflow completion

- **Pending purchases:** Goods receipts now has a dedicated Pending purchases queue with supplier, warehouse, remaining PCS/value, search, pagination, and a Receive goods action that preselects the order. Fully received orders disappear from the queue. See [pending-purchase UI](frontend/features/documents/components/PendingPurchases.jsx).
- **Product transaction drilldown:** movement rows link to their original GRN/sale/return/adjustment when the current user may read it. Purchase/sales history tabs link directly to their documents.
- **Cashier purchase ambiguity:** purchase creation/confirmation continues to require Admin, Manager, or Purchase, preserving the existing write policy. Cashier remains a sales/collection role. Warehouse staff and accountants can inspect required source documents without gaining purchase-posting permissions.

## Where to use the completed features

| Feature | Location |
| --- | --- |
| Dashboard dates | Overview → From date / To date → Apply dates |
| Audit history | Administration → Audit history, available to Admin and Manager |
| Purchase summary/print | Purchases → View transaction → Print voucher |
| Profile history | Products / Customers / Suppliers → View profile; use tabs, dates, search, and page controls |
| Expense summary | Reports & ledgers → Expenses; apply dates, name, or payment account |
| Ledger totals export | Reports & ledgers → Customer/Supplier ledger → Excel export → Grand totals worksheet |
| Return preview | New sales/purchase return → select original document → enter return PCS |
| Pending receiving | Goods receipts → Pending purchases → Receive goods |

## Document reader policy

Admin and Manager can read every document type. Additional readers are explicit below. Writers/posters retain their existing role restrictions; only Admin/Manager can post stock adjustments.

| Document | Additional readers |
| --- | --- |
| Purchases | Purchase, Warehouse, Accountant |
| Goods receipts | Purchase, Warehouse, Accountant |
| Sales invoices | Cashier, Accountant |
| Customer receipts | Cashier, Accountant |
| Supplier payments | Accountant |
| Sales returns | Cashier, Accountant |
| Purchase returns | Purchase, Accountant |
| Stock adjustments | Warehouse, Accountant |
| Expenses | Accountant |

Master-data lookup access remains available where a form needs it. Reading an approved source document does not grant permission to create, edit, post, or reverse it. Audit history is limited to Admin/Manager; journal creation/reversal remains Admin/Accountant.

## Verification

- `npm test`: **30 unit/model tests pass** across the independent applications.
- `npm run check`: backend syntax/direct-SQL checks pass.
- `npm run build`: production frontend build passes.
- `npm run test:integration`: **27 TAP entries pass**: 26 workflow subtests and their parent, including actual Chromium browser checks.
- The expanded HTTP checks exercise all six roles against both list and detail endpoints for all nine document types, plus audit-history access.
- The exact multi-product example is verified: 20,000 purchase; 16,000 first GRN and 4,000 second GRN; 8,000 supplier payment leaving 12,000 AP; 7,300 sale with 2,000 previous due and 3,000 payment leaving 6,300 customer due. Remaining quantities are 70 bulbs and 40 switches. Gross profit is 2,300; expenses 300; net profit 2,000.
- Further assertions cover history search/date/page boundaries, empty expense filters, summary totals beyond one page, expense reversal dates, password-change audit success/rollback, sensitive detail redaction, Excel totals, and cumulative return rounding.
- Browser checks use the actual date controls, audit filters/detail dialog, purchase summary/PDF printing, transaction/payment history page navigation and nested drilldown, expense summary, return preview, pending-order receiving form, and Cashier route guards. The generated purchase PDF was inspected as a one-page A4 document with all columns and totals visible.

Tests create and remove a uniquely named disposable database using schema definitions from `batteryPos`. They do not use production business records as fixtures. The existing environment file and uploaded files were checked byte-for-byte and preserved. Backend and frontend retain separate dependency installations and lockfiles.

## Scope retained

All previously implemented core modules remain available: master data, purchasing/partial GRNs, inventory, customers, sales/POS, customer/supplier payments, advances and allocations, returns, expenses, journals, reconciliation, company/warehouse/account/user settings, and Walton reports.

The specification's explicit exclusions remain excluded: bundles/kits, multiple units/conversion, variant matrices, separate supplier-bill approval, partial sales dispatch, warehouse transfers, separate damaged-stock quantities, cheque clearing/bounce processing, cash-refund workflows, customer document uploads, custom permission builders, and SQL views.

The existing 50,000-row ledger/export bound remains. Representative browser tests and financial reconciliation do not certify every possible operating scenario or production-volume performance.
