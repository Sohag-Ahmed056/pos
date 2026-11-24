# Frontend architecture

The client uses JavaScript, React, Tailwind CSS, React Router, Redux Toolkit, and RTK Query. The Express backend, database schema, API paths, and transaction rules are preserved.

## Structure

```text
frontend/
  main.jsx                  Browser entry point
  app/                      Providers, store, router, navigation, workspace layout
  components/
    ui/                     Buttons, fields, dialogs, feedback, notifications
    data/                   Tables, pagination, search, cached resource lookups
    layout/                 Page headers, panels, metric cards
  features/
    auth/                   Sessions, sign-in, password changes, auth state
    catalog/                Product, customer, supplier, warehouse, team and account directories
    dashboard/              Metrics, sales activity, stock watch, recent activity
    documents/              Purchases, GRNs, sales, payments, returns, expenses, adjustments
    reports/                Report filters, ledgers, exports, totals, reconciliation
    accounting/             Journal entry, journal lines, authorized reversals
    audit/                  Read-only activity review, filters, pagination, details
  hooks/                    Shared debounce and idempotent-mutation hooks
  lib/                      Formatting, errors, query serialization, downloads, request keys
  services/                 Base API, session refresh, shared resource-query cache
```

Each substantial feature keeps page containers in `pages`, presentation and form components in `components`, behavior in `hooks`, pure transformations in `model`, metadata in `config`, and its endpoint definitions in `<feature>Api.js`. Small features only contain the directories they need.

## Responsibility boundaries

- `app` composes the workspace and lazy feature routes. Sidebar sections and route roles come from the same navigation definitions. Dynamic catalog/document routes validate the module before mounting a page. The backend continues to enforce authorization independently.
- Shared components handle presentation and interaction. `ResourceLookup` is the data-aware exception: it composes the shared resource API and debounced search to support the same selection control across features.
- Feature page containers assemble queries, toolbars, tables, and dialogs. They do not build SQL, post financial entries, or implement inventory rules.
- Feature hooks own form lifecycles and asynchronous workflows. For example, `useDocumentEditor` coordinates the saved draft, posting, payment, source-document selection, and quick-add dialogs.
- Pure model modules serialize the exact backend payloads and calculate display totals. The document model never includes previous due or historical snapshots in new-sales payloads. These modules are tested directly without a browser or database.
- Endpoint paths, request methods, tags, and invalidation live in API modules. Components call named feature hooks instead of constructing request URLs. All APIs extend one `baseApi` and one middleware instance.

## Transaction editor

`DocumentEditor` composes `DocumentHeaderFields`, `ProductItemsEditor`, `InvoiceTotals`, `SourceItemsTable`, `PaymentFields`, `AdjustmentFields`, and `PaymentAllocationsTable`. The editor hook owns state and orchestration; the model module owns payload serialization and decimal calculations. Voucher rendering and allocation of already-posted payments are separate components.

Catalog quick-add is provided by `CatalogRecordForm` and reused by the transaction feature. The payment-account form reuses it to create distinct asset GL accounts. Tables, pagination, empty/error/loading states, dialogs, panels, and page headers are shared components.

## State and API lifecycle

- Redux holds the authenticated user and in-progress sales cart.
- RTK Query owns API responses, request state, caching, and invalidation. API results are not copied into additional Redux slices.
- Resource list/detail endpoints are shared between feature screens and lookups so the same query can reuse its cache.
- Feature mutations invalidate the relevant catalog/document tags and financial report tags after success. Failed mutations do not invalidate successful query data.
- Concurrent expired requests share a single refresh request. Sign-out or an invalid session clears the user and cart.
- `useIdempotentMutation` retains a payload-specific request key after a failed request and releases it only after an acknowledged success. Server-side idempotency and transactions remain authoritative.
- Report filter state is reflected in the URL; exports use the applied filters. Excel downloads use the same API/session-refresh path as other requests.

## Extending the client

Add directory metadata to `features/catalog/config/catalogResources.js`; add transaction metadata and supported payload fields to the documents configuration/model. Build new form sections as focused components rather than adding large conditionals to a page. Add new backend interactions to a feature API module. Keep domain transforms in pure model functions and verify changes through the existing tests and browser suite.

The frontend is a standalone npm project with its own `package.json`, `package-lock.json`, and `node_modules`. Run `npm ci` and `npm run dev` inside `frontend` to install its dependencies and start Vite. Vite proxies `/api` requests to the backend on port 3001. Build this app with `npm run build` from `frontend`; neither installation nor building requires backend dependencies or a main-folder dependency installation.

The main project folder provides optional `npm test`, `npm run check`, `npm run build`, and `npm run test:integration` shortcuts that delegate to each application. The frontend model tests are in `frontend/tests/frontend.test.cjs`; `npm test` inside `frontend` runs just these tests. Integration/browser checks live in `backend/tests` and use synthetic records in a disposable database; they never test against production business records.


## Completed audit features

Audit review is a separate lazy-loaded feature with its own API, hook, filters, and page. `features/auth/permissions.js` defines document readers for navigation and profile drilldowns; the backend independently enforces the matching policy. Document writers remain separate.

Catalog profiles compose a reusable history table with separate transaction/payment pagination and product-history tabs. Document details render an isolated print portal so application layout and modal scrolling cannot clip printed vouchers. Original-source pricing and cumulative decimal previews live in `documents/model/sourcePreview.js`; server-provided pricing bases match posting calculations. Dashboard date controls apply URL filters; expense reports render whole-filter summaries and export the same applied filters.

See [../FEATURE_AUDIT.md](../FEATURE_AUDIT.md) for verification and the final role matrix.
