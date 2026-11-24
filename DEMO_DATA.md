# Demo data for BatteryPOS

The explicit demo loader adds data to the existing **batteryPos** database. Start the backend and frontend normally, open **http://127.0.0.1:5173**, and sign in with a demo account.

All six demo accounts initially use the password **`Demo@2026Test!`**:

| Role | Email |
| --- | --- |
| Admin | `demo.admin@batterypos.test` |
| Manager | `demo.manager@batterypos.test` |
| Purchase | `demo.purchase@batterypos.test` |
| Warehouse | `demo.warehouse@batterypos.test` |
| Cashier | `demo.cashier@batterypos.test` |
| Accountant | `demo.accountant@batterypos.test` |

Existing accounts and passwords are preserved. Demo accounts are ordinary application users; changing a demo password through the app will persist across loader reruns.

## Included data

| Area | Demo examples |
| --- | --- |
| Company | Demo company information, only when company settings are empty |
| Products | 13 battery/accessory products, including an inactive product, low stock, and an item awaiting its first receipt |
| Warehouses | Dhaka showroom, Chattogram branch, service/warranty store |
| Customers | 12 customers with party, area, channel, shop, address and sample identity/bank fields |
| Suppliers | 4 battery, automotive, IPS/solar and accessory suppliers |
| Payment accounts | Separate cash, bank, bKash, Nagad and card-clearing accounts with opening funds |
| Purchasing | 5 purchases: 2 fully received, 2 pending/partially received, 1 draft |
| Receiving | 4 posted GRNs and 1 draft; includes a two-delivery purchase and an outstanding delivery |
| Sales | 37 posted invoices and 1 draft; cash, partial-payment and credit sales, with line/invoice discounts |
| Collections | Receipts created during sales plus separate collections, multiple-invoice allocation, later allocation, an unallocated advance, and a draft |
| Supplier payments | 4 posted payments and 1 draft, including multiple-GRN and later allocations |
| Returns | Saleable, damaged and fully paid invoice returns, a purchase return, and draft returns |
| Stock adjustments | 17 opening stock documents, 1 increase, 1 decrease and 1 draft |
| Expenses | 7 posted expenses, 1 reversed (VOID) expense, and 1 editable draft |
| Accounting | Opening cash/bank/wallet funds, customer/supplier opening balances, manual adjustments and two reversal journals |
| Audit | Directory creation, document saves/posts, allocation changes, return allocation release and demo-loader events |

Demo directory names start with **`[DEMO]`** and product SKUs with **`DEMO-`**. Transaction voucher numbers use the application's usual generated format. Their IDs, numbers, statuses, dates and labels are listed in [backend/artifacts/demo-data.json](backend/artifacts/demo-data.json) after a successful loader run.

## Things to try

1. **Dashboard:** compare this month with the full demo report period. Review sales, purchases, collections, profit, stock alerts and activity.
2. **Purchases and GRNs:** inspect `DEMO-SUP-001` for a completed two-delivery order. In **Goods receipts → Pending purchases**, find `DEMO-SUP-002` and receive its remaining 25 PCS. `DEMO-SUP-004` has 70 PCS still to receive. A separate draft GRN is ready for posting against the partial order; posting it reduces what remains available to receive.
3. **Sales:** open paid, partially paid and unpaid invoices. The first sale for `[DEMO] Dhaka Battery House` captures a previous balance of ৳12,000. Edit the draft invoice and post it with or without a payment. Add a product twice to check cart consolidation.
4. **Receipts:** `[DEMO] Advance Customer` begins with an unallocated ৳5,000 advance and a ledger closing balance of **−৳5,000**. `[DEMO] Mirpur Auto Care` has a receipt allocated to multiple invoices. `[DEMO] Gazipur Transport` has a ৳2,000 receipt with only ৳1,000 allocated, leaving another ৳1,000 available for allocation.
5. **Payments:** inspect supplier allocation histories, then post the draft supplier payment. Keep payment amounts within the supplier's payable balance.
6. **Returns:** compare the saleable return with the damaged return; only the saleable return restores stock. A full return of a paid invoice releases its receipt allocation. Post the draft sales/purchase returns to exercise original-line limits and net return previews.
7. **Inventory:** compare stock across warehouses and inspect movement history. The terminal pair starts at 3 PCS in the showroom, below its reorder level. Battery water has no received stock yet; receive its pending purchase before selling it. Post the draft stock increase to test inventory corrections.
8. **Profiles:** open customer, supplier and product profiles. Search/filter dated histories, change pages, and open the original documents. Product histories include purchases, sales and movements.
9. **Reports:** run customer/supplier ledgers and party/area/channel subtotals, outstanding balances, monthly/product sales, purchases, stock/valuation/movements, collections, supplier payments, cash/bank, expenses, profit/loss and general ledger. Try PDF, Excel and print exports. Print a purchase to inspect its totals and receiving quantities.
10. **Accounting:** inspect balanced opening entries, the bank-fee adjustment and reversal entries. The incorrect delivery expense is reversed on the following day, so expense filters can show the original and reversal separately. Use Reconciliation to check stock quantities, inventory value and journals.
11. **Users and audit:** sign in with each role to test permitted screens/actions. As Admin/Manager, filter the audit history and inspect event details. Create a record, change a demo password, and verify the resulting audit history.

## Report dates and reruns

The first run anchors the dataset to the current Bangladesh date. Transactions span the preceding **46 days through that date**, providing activity across two months. The CLI prints the exact period, also saved as `from`/`to` in `backend/artifacts/demo-data.json`. Use that full period to see all demo activity. Stock movements and audit events use their actual creation times, as they do for normal application transactions.

The dataset loaded into this workspace uses **10 September 2026 through 26 October 2026**.

To run the loader explicitly:

```sh
# From the main folder (or use the same command inside backend)
npm run seed:demo
```

It requires an existing active administrator and the existing POS tables/core account codes. A database advisory lock prevents simultaneous loader runs. Every financial operation uses the existing atomic transactions and stable idempotency keys. If a run is interrupted, completed steps remain committed and rerunning resumes the dataset. Rerunning retains the original dates, preserves existing records, and does not reset changes you make to demo drafts or passwords. It does not remove data or generate a fresh dated batch.

The loader also initializes company information when it is empty; existing company information is preserved. Demo payment accounts use their own asset accounts so existing cash/bank balances are not used for demo payments. Demo transactions are normal persisted records and therefore appear in the application's combined financial reports.

To verify the loader using a disposable database:

```sh
npm run test:demo
```

This test reads only the existing table definitions, creates a random `batteryPos_test_<random>` database, tests the workflows/interrupted run/replay, and drops that test database. It does not populate or alter `batteryPos` records.
