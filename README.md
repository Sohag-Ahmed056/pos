# BatteryPOS

A React and Express POS application using the existing **batteryPos** MySQL 8 database and the existing `mysql2/promise` connection pool. All database access uses direct, parameterized SQL. There is no ORM, schema generator, migration runner, SQL view, or duplicate ledger table.

Customer and supplier profiles include separate product-wise ledgers. **Inventory → Product Ledger** provides standalone stock and transaction history. See [Product ledger usage and accounting rules](PRODUCT_LEDGERS.md).

## Project layout

The current `PosBackend` directory is the main project folder. The backend and frontend are standalone npm projects, each with its own dependencies, lockfile, and scripts:

```text
PosBackend/
  backend/
    package.json
    package-lock.json
    node_modules/           Backend dependencies
    .env
    .env.example
    src/                    Express API, services, direct MySQL connection
    scripts/                Backend checks and test runner
    tests/                  Backend unit and integration/browser tests
    uploads/                Existing uploaded files
    schema.sql              Legacy reference only
    postman_collection.json
  frontend/
    package.json
    package-lock.json
    node_modules/           Frontend dependencies
    app/                    React providers, routes, store, layout
    components/             Shared components
    features/               Feature modules
    tests/                  Frontend model tests
    vite.config.mjs
  package.json              Optional shortcuts; no dependencies or workspaces
```

Install dependencies separately in each application with `npm ci`. There is no shared main-folder `node_modules` directory or lockfile. Each application can be copied and installed on its own.

## Start development

Use Node.js 22 or newer. Development uses Node’s built-in file watcher.

1. Configure `backend/.env` using `backend/.env.example`. The existing environment file has been moved there. Set `DB_NAME=batteryPos` and the connection details for your existing database. Keep credentials out of version control.
2. Install backend dependencies with `npm ci` inside `backend` and frontend dependencies with `npm ci` inside `frontend`.
3. If the database has no administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters, then explicitly run `npm run seed` inside `backend`. This inserts only that user into the existing `users` table and never overwrites an existing account. No default login is created automatically.
4. Start Express with `npm run dev` inside `backend` in one terminal.
5. Start React with `npm run dev` inside `frontend` in another. Open **http://127.0.0.1:5173**. The Vite proxy forwards `/api` to Express on port 3001.

From the main folder, use two terminals:

```sh
# Terminal 1, from the main folder
cd backend
npm ci
npm run dev
```

```sh
# Terminal 2, from the main folder
cd frontend
npm ci
npm run dev
```

The main folder's optional shortcuts still work: `npm run install:all` installs both apps using their own lockfiles, `npm run dev` starts the backend, and `npm run client:dev` starts the frontend. The shortcuts do not install shared dependencies.

Set `FRONTEND_ORIGIN` to the exact browser origin. The default is `http://127.0.0.1:5173`; accessing the client through `localhost` requires the corresponding origin configuration. Database credentials are used only by Express.

`backend/schema.sql` is the starter's legacy `admins` table definition. **Do not apply it to batteryPos.** The application uses the existing 30-table POS database, including `users`.

## Demo data

Run `npm run seed:demo` from the main folder, or from `backend`, to explicitly add the demo dataset to `batteryPos`. It reuses the existing services, MySQL pool, transactions, posting rules, and audit log. It preserves existing directory records and accounts. Repeated runs resume the same dataset using stored dates and idempotency keys; they do not generate another batch of transactions or reset passwords. Demo data remains in the database for testing.

See [DEMO_DATA.md](DEMO_DATA.md) for demo logins, examples to try, report dates, and voucher references. `npm run test:demo` verifies this loader in a disposable database, including recovery from an interrupted run and a second run that changes no records.

## Production

```sh
npm --prefix backend ci --omit=dev
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix backend start
```

Run these commands from the main folder. When the sibling `frontend/dist` directory exists, Express serves that build and handles client-side routes. The backend also runs independently as an API; a separately hosted frontend needs its `/api` requests forwarded to the backend. Set `NODE_ENV=production`, `FRONTEND_ORIGIN=https://your-application.example`, and distinct access/refresh JWT secrets of at least 32 characters in `backend/.env`. Use HTTPS at your reverse proxy. Choose a database account with the application's required DML privileges; the application does not need permission to create, drop, or alter production tables.

The default Express port is 3001. `/health` remains available. The original `/api/v1/auth` routes and response envelope remain in use.

## Workflow

- Configure company information, warehouses, users, and payment accounts. The payment-account form can quick-add a distinct asset GL account for each bank, bKash, or Nagad account; existing chart entries remain protected. Products are individual items; stock is not editable on a product record.
- Opening stock and subsequent adjustments are drafted under Stock adjustments. Only an Admin or Manager can post them.
- Draft a purchase, confirm it, then post one or more partial goods receipts. Confirmation alone never changes stock or supplier payable.
- Draft and post sales from the Sales screen. Previous due comes from the AR journal and is never posted as revenue. Payment collected during posting creates a separate receipt and balanced journal inside the same database transaction.
- Customer receipts support partial settlement and unallocated advances. Supplier payments settle posted GRNs and cannot exceed the supplier's current payable. Payments can be allocated across several documents, including later allocation of an existing posted receipt/payment.
- Returns reference original posted invoice/GRN lines. Returns reduce the remaining eligible quantity. Only saleable sales returns restore stock. Any payment allocation released by a return is recorded in the audit log.
- Expenses support draft editing and posting. Authorized accounting users can post opening balances/manual adjustments and reverse manual or expense journals. Inventory corrections use returns or stock adjustments.
- Reports include the customer ledger's exact 11 visible columns, supplier ledger, grouping subtotals, stock, valuation, sales, purchases, payments, expenses, profit/loss, cash/bank, general ledger, and reconciliation.

All monetary postings use decimal arithmetic. Currency amounts have two decimal places; unit prices and weighted average costs support four. Quantity is a whole-number PCS value. Stock movements and journals are created only while posting. Adjustments and purchase-return valuation differences use the existing stock gain/loss accounts to keep the inventory balance and inventory GL reconciled.

## Frontend organization

The frontend uses feature modules for authentication, directories, dashboard, transactions, reports, and accounting. Pages compose reusable components; feature hooks own workflows, model functions serialize payloads, and feature API modules extend a shared RTK Query service. The old combined page/UI/store files have been replaced.

See [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) for the module layout, dependency boundaries, state/cache behavior, and extension guidelines.

The features identified by the specification audit are completed. See [FEATURE_AUDIT.md](FEATURE_AUDIT.md) for their locations, role rules, and verification. Overview has date controls and today's collection. Administration includes read-only audit history for Admin/Manager. Profiles have searchable, dated, paginated histories and document drilldowns. Goods receipts includes a pending-purchases queue; purchase printing includes totals and receiving quantities. Return forms preview original net rates and amounts. Expense reports provide complete filtered totals/grouping, and ledger Excel files include an explicit Grand totals worksheet.

## API

Base URL: `/api/v1`. Protected requests require an access cookie or `Authorization: Bearer <accessToken>`. The React client uses HTTP-only cookies and keeps user/cart state in Redux; API data stays in RTK Query.

| Module | Endpoints |
| --- | --- |
| Authentication | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Asset account setup | `GET/POST /accounts` (new asset accounts only; existing GL codes cannot be edited) |
| Directories | `GET/POST /products`, `/customers`, `/suppliers`, `/warehouses`, `/payment-accounts`, `/users`, `/company` |
| Directory records | `GET/PUT /<resource>/:id`; deletion for unreferenced products/customers/suppliers/warehouses |
| History | `GET /products/:id/history`, `/customers/:id/history`, `/suppliers/:id/history` |
| Documents | `GET/POST /purchases`, `/grns`, `/sales`, `/receipts`, `/payments`, `/sales-returns`, `/purchase-returns`, `/adjustments`, `/expenses` |
| Document records | `GET/PUT /<document>/:id`; edits are restricted to drafts |
| Posting | `POST /<document>/:id/post` (`purchases` confirms the order) |
| Allocations | `POST /receipts/:id/allocations`, `POST /payments/:id/allocations` |
| Available invoices/GRNs | `GET /settlements/customer/:id`, `GET /settlements/supplier/:id` |
| Accounting | `POST /journals`, `POST /journals/:id/reverse` |
| Reporting | `GET /dashboard`, `GET /reports/:name`, `GET /reports/reconciliation` |
| Audit history | `GET /audit-logs` (Admin/Manager only; read-only) |
| Pending receiving | `GET /pending-purchases` (purchase/receiving readers) |

Directory and document lists accept `page`, `limit` (maximum 100), and `search`. Documents also accept `status`; sales/receipts and purchases/payments accept `party_id`. Products accept `category`, `brand`, and `active`.

Document lists also accept `from`/`to`. Profile history responses include `meta`; histories support search, dates, and page/limit. Product history accepts `type=movements`, `type=purchases`, or `type=sales`, with permissions checked for each kind. Document read permissions match the frontend's read policy; write/post rights remain separate.

`GET /dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` defaults to the current Bangladesh month through today. Purchases, collections, payments, expenses, profit, chart, and activity use that period. Today/month sales and today's collection use Bangladesh time; stock and outstanding balances remain current. Expense reports additionally accept `expense_name` and `payment_account_id` and include full-filter totals/grouping. Expense reversals are reported on their journal dates.

Audit history accepts `page`, `limit`, `search`, `from`, `to`, `user_id`, exact `action`, and exact `entity`. Audit date filters/timestamps are UTC. Returned details redact credentials and session identifiers. No audit create/update/delete endpoint is exposed.

Every document save, post, payment allocation, manual journal, and reversal requires an **`Idempotency-Key`** header containing 8–100 letters, digits, underscores, or hyphens. Reuse the same key when retrying the same request. Reusing it with a different body returns HTTP 409. Successful financial retries return the original ID. The key, document, journals, stock changes, and audit entries commit atomically.

Posting normally accepts `{}`. Sales posting may include:

```json
{
  "payment": {
    "payment_account_id": "1",
    "amount": "3000.00",
    "reference_no": "optional reference"
  }
}
```

Amounts and IDs are accepted as strings to avoid integer/decimal precision loss. Line quantities must be integer JSON numbers. A purchase or sale payload contains the applicable party ID, warehouse ID, transaction date, and an `items` array with `product_id`, `quantity_pcs`, `unit_cost` or `unit_price`, and optional `discount_amount`. Header sales discount is separate from line discounts.

Receipt/payment payloads use `customer_id`/`supplier_id`, `receipt_date`/`payment_date`, `payment_account_id`, `amount`, optional reference/bank/cheque details, and optional `allocations: [{ "document_id": "1", "amount": "100.00" }]`.

Report names: `customer-ledger`, `supplier-ledger`, `sales`, `monthly-sales`, `product-sales`, `purchases`, `stock`, `stock-movements`, `valuation`, `low-stock`, `customer-outstanding`, `supplier-outstanding`, `collections`, `supplier-payments`, `cash-bank`, `expenses`, `profit-loss`, `general-ledger`, and `reconciliation`.

Date filters are `from` and `to` in `YYYY-MM-DD`. Ledgers support `customer_id`/`supplier_id`; customer ledger grouping filters are `party`, `area`, and `channel`. Current inventory reports support `product_id` and `warehouse_id`. Add `format=pdf`, `format=xlsx`, or `format=print` for a complete filtered export/printable PDF. Exports and ledger reports are bounded at 50,000 rows; narrow filters for larger histories. Current stock/valuation are current-state reports; historical financial reports use GL dates. General ledger includes `journal_id` for authorized reversals.

Customer ledger running balances are computed with MySQL 8 window functions. Opening balances include postings before `from`; activity and subtotals use the complete filter range. Customer, party, area, and sales-channel subtotals are returned separately from the eleven visible columns. Party/area/channel groupings use journal snapshots rather than the party's current grouping fields.

Customer ledger screen, PDF/print, and Excel exports follow the supplied Walton statement layout: company heading, selected period, sales channel/area/party/address/customer identity, two-level Debit/Credit headings, eleven columns, bordered transactions, customer/party/area/channel subtotals and Grand Total. The Company column uses the configured company code. PDF/print uses A4 landscape, embedded Arimo fonts, repeated customer/table headings on continued pages, page numbering, and a Bangladesh-time print timestamp. Full generated voucher numbers wrap without truncation. Subtotals retain separate sales, adjustment, collection and return amounts. Exported totals use the complete filtered dataset, independent of screen pagination. Existing accounting calculations and database records are unchanged by this presentation.

Supplier, general ledger, cash/bank and stock-movement reports use the same statement design on screen and in PDF/print/Excel exports. Supplier statements retain opening/running payable balances and supplier subtotals. General ledger and cash/bank statements group transactions by account and show complete-period debits, credits and net movement; these movement totals are not labeled as closing balances. Stock statements group by warehouse/product and show PCS in/out/net with four-decimal movement costs. All exports retain company identity, selected period, repeated table headings, borders, subtotals and page footers. General ledger accepts `account_id`, cash/bank accepts `payment_account_id`, and stock movements accept `product_id`/`warehouse_id`; the corresponding controls are available on Reports & ledgers. Totals and subtotals cover the full filter range even while viewing a single screen page.

## Verification

```sh
npm test
npm run check
npm run build
npm run test:integration
```

`npm test` runs the decimal arithmetic, validation, ledger subtotal, and frontend model/payload tests without connecting to MySQL. `npm run check` validates backend JavaScript syntax and checks that the source does not use an ORM.

These main-folder commands delegate to the independent apps. Inside `backend`, run `npm test`, `npm run check`, or `npm run test:integration`. Inside `frontend`, run `npm test` or `npm run build`.

Integration tests require MySQL access and permission to create/drop **test databases only**. They read `SHOW CREATE TABLE` definitions from `batteryPos`, create a random `batteryPos_test_<random>` database, insert synthetic records there, and drop only that newly created database during cleanup. Existing batteryPos business records are never read for fixtures or changed. If a test process is forcibly killed, its uniquely named test database may require manual cleanup.

The suite verifies partial GRNs, stock concurrency, atomic sales/payment rollback, idempotency, customer advances and allocations, supplier payments, returns, expense reversals, journal/stock reconciliation, ledger snapshots/subtotals, role checks, session rotation/revocation, and real PDF/Excel exports. If `/usr/bin/chromium` and the frontend build are available, the suite also verifies representative browser pages and writes desktop/mobile screenshots under `backend/artifacts/` using synthetic test data. Browser checks cover the inspected screens; they are not an exhaustive user-acceptance or load test.

No database migrations, production seeds, or deployments run automatically.
