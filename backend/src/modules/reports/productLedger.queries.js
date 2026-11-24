// Separate, read-only product reports. Financial ledger queries are deliberately not reused.
// Window calculations precede product/date/search filters: invoice discounts and partial
// return cents must retain exactly the same basis and posting order as operations.service.
const salesCtes = (scope = '1=1') => `
sale_lines AS (
 SELECT i.*,h.customer_id,h.warehouse_id,h.invoice_no,h.invoice_date,h.posted_at,h.discount_amount header_discount,
 ROUND(i.quantity_pcs*i.unit_price-i.discount_amount,2) line_net,
 SUM(ROUND(i.quantity_pcs*i.unit_price-i.discount_amount,2)) OVER(PARTITION BY h.id ORDER BY i.id) cumulative_net,
 SUM(ROUND(i.quantity_pcs*i.unit_price-i.discount_amount,2)) OVER(PARTITION BY h.id) invoice_net
 FROM sales_invoices h JOIN sales_invoice_items i ON i.sales_invoice_id=h.id
 WHERE h.status='POSTED' AND ${scope}
), sale_bases AS (
 SELECT s.*,line_net-IF(invoice_net=0,0,
 ROUND(CAST(header_discount*cumulative_net AS DECIMAL(60,20))/invoice_net,2)-ROUND(CAST(header_discount*(cumulative_net-line_net) AS DECIMAL(60,20))/invoice_net,2)) basis
 FROM sale_lines s
), sale_return_quantities AS (
 SELECT ri.*,r.return_no,r.return_date,r.posted_at,
 SUM(ri.quantity_pcs) OVER(PARTITION BY ri.sales_invoice_item_id ORDER BY r.posted_at,r.id,ri.id) returned_after
 FROM sales_return_items ri JOIN sales_returns r ON r.id=ri.sales_return_id
 JOIN sale_bases s ON s.id=ri.sales_invoice_item_id WHERE r.status='POSTED'
), sale_return_values AS (
 SELECT r.*,ROUND(CAST(s.basis*r.returned_after AS DECIMAL(60,20))/s.quantity_pcs,2)
 -ROUND(CAST(s.basis*(r.returned_after-r.quantity_pcs) AS DECIMAL(60,20))/s.quantity_pcs,2) return_amount,
 ROUND(CAST(ROUND(s.quantity_pcs*s.unit_price,2)*r.returned_after AS DECIMAL(60,20))/s.quantity_pcs,2)
 -ROUND(CAST(ROUND(s.quantity_pcs*s.unit_price,2)*(r.returned_after-r.quantity_pcs) AS DECIMAL(60,20))/s.quantity_pcs,2) return_gross
 FROM sale_return_quantities r JOIN sale_bases s ON s.id=r.sales_invoice_item_id
), sales_activity AS (
 SELECT s.id line_id,s.invoice_date date,s.invoice_no voucher,'SALE' type,'sales' document_resource,
 s.sales_invoice_id document_id,s.invoice_no original_voucher,'sales' original_resource,s.sales_invoice_id original_id,
 s.customer_id, NULL supplier_id,c.name party,s.warehouse_id,w.name warehouse,
 s.product_id,s.product_name_snapshot product,s.sku_snapshot sku,
 s.quantity_pcs sold,0 received,0 returned,0 ordered,s.quantity_pcs net_quantity,s.unit_price rate,
 ROUND(s.quantity_pcs*s.unit_price,2) gross_amount,
 ROUND(s.quantity_pcs*s.unit_price,2)-s.basis discount,s.basis amount,0 ordered_value,1 saleable,s.invoice_no order_voucher,s.posted_at sort_at
 FROM sale_bases s JOIN customers c ON c.id=s.customer_id JOIN warehouses w ON w.id=s.warehouse_id
 UNION ALL
 SELECT r.id,r.return_date,r.return_no,'SALE_RETURN','sales-returns',r.sales_return_id,
 s.invoice_no,'sales',s.sales_invoice_id,s.customer_id,NULL,c.name,s.warehouse_id,w.name,
 s.product_id,s.product_name_snapshot,s.sku_snapshot,0,0,r.quantity_pcs,0,-r.quantity_pcs,s.unit_price,
 -r.return_gross,r.return_amount-r.return_gross,
 -r.return_amount,0,r.saleable,s.invoice_no,r.posted_at
 FROM sale_return_values r JOIN sale_bases s ON s.id=r.sales_invoice_item_id
 JOIN customers c ON c.id=s.customer_id JOIN warehouses w ON w.id=s.warehouse_id
)`;

const purchaseCtes = (scope = '1=1') => `
purchase_lines AS (
 SELECT i.*,p.supplier_id,p.warehouse_id,p.purchase_no,p.purchase_date
 FROM purchases p JOIN purchase_items i ON i.purchase_id=p.id
 WHERE p.status IN ('CONFIRMED','CLOSED') AND ${scope}
), receipt_lines AS (
 SELECT gi.*,g.grn_no,g.received_date,g.posted_at FROM goods_receipt_items gi
 JOIN goods_receipts g ON g.id=gi.goods_receipt_id JOIN purchase_lines p ON p.id=gi.purchase_item_id
 WHERE g.status='POSTED'
), purchase_return_quantities AS (
 SELECT ri.*,r.return_no,r.return_date,r.posted_at,
 SUM(ri.quantity_pcs) OVER(PARTITION BY ri.goods_receipt_item_id ORDER BY r.posted_at,r.id,ri.id) returned_after
 FROM purchase_return_items ri JOIN purchase_returns r ON r.id=ri.purchase_return_id
 JOIN receipt_lines gi ON gi.id=ri.goods_receipt_item_id WHERE r.status='POSTED'
), purchase_return_values AS (
 SELECT r.*,ROUND(CAST(g.line_amount*r.returned_after AS DECIMAL(60,20))/g.quantity_pcs,2)
 -ROUND(CAST(g.line_amount*(r.returned_after-r.quantity_pcs) AS DECIMAL(60,20))/g.quantity_pcs,2) return_amount,
 ROUND(CAST(ROUND(g.quantity_pcs*p.unit_cost,2)*r.returned_after AS DECIMAL(60,20))/g.quantity_pcs,2)
 -ROUND(CAST(ROUND(g.quantity_pcs*p.unit_cost,2)*(r.returned_after-r.quantity_pcs) AS DECIMAL(60,20))/g.quantity_pcs,2) return_gross
 FROM purchase_return_quantities r JOIN receipt_lines g ON g.id=r.goods_receipt_item_id
 JOIN purchase_lines p ON p.id=g.purchase_item_id
), purchase_activity AS (
 SELECT p.id line_id,p.purchase_date date,p.purchase_no voucher,'ORDER' type,'purchases' document_resource,
 p.purchase_id document_id,p.purchase_no original_voucher,'purchases' original_resource,p.purchase_id original_id,
 NULL customer_id,p.supplier_id,s.name party,p.warehouse_id,w.name warehouse,
 p.product_id,p.product_name_snapshot product,p.sku_snapshot sku,
 0 sold,0 received,0 returned,p.quantity_pcs ordered,0 net_quantity,p.unit_cost rate,
 0 gross_amount,0 discount,0 amount,ROUND(p.quantity_pcs*p.unit_cost-p.discount_amount,2) ordered_value, NULL saleable,p.purchase_no order_voucher,CAST(p.purchase_date AS DATETIME) sort_at
 FROM purchase_lines p JOIN suppliers s ON s.id=p.supplier_id JOIN warehouses w ON w.id=p.warehouse_id
 UNION ALL
 SELECT g.id,g.received_date,g.grn_no,'GRN','grns',g.goods_receipt_id,p.purchase_no,'purchases',p.purchase_id,
 NULL,p.supplier_id,s.name,p.warehouse_id,w.name,p.product_id,p.product_name_snapshot,p.sku_snapshot,
 0,g.quantity_pcs,0,0,g.quantity_pcs,p.unit_cost,
 ROUND(g.quantity_pcs*p.unit_cost,2),ROUND(g.quantity_pcs*p.unit_cost,2)-g.line_amount,g.line_amount,0,NULL,p.purchase_no,g.posted_at
 FROM receipt_lines g JOIN purchase_lines p ON p.id=g.purchase_item_id
 JOIN suppliers s ON s.id=p.supplier_id JOIN warehouses w ON w.id=p.warehouse_id
 UNION ALL
 SELECT r.id,r.return_date,r.return_no,'PURCHASE_RETURN','purchase-returns',r.purchase_return_id,
 g.grn_no,'grns',g.goods_receipt_id,NULL,p.supplier_id,s.name,p.warehouse_id,w.name,
 p.product_id,p.product_name_snapshot,p.sku_snapshot,0,0,r.quantity_pcs,0,-r.quantity_pcs,p.unit_cost,
 -r.return_gross,r.return_amount-r.return_gross,-r.return_amount,0,NULL,p.purchase_no,r.posted_at
 FROM purchase_return_values r JOIN receipt_lines g ON g.id=r.goods_receipt_item_id
 JOIN purchase_lines p ON p.id=g.purchase_item_id
 JOIN suppliers s ON s.id=p.supplier_id JOIN warehouses w ON w.id=p.warehouse_id
)`;

// These are the actual source_type/source_line_id conventions used by stock().
const movementCtes = (warehouse = false) => `
movement_sources AS (
 SELECT m.*,w.name warehouse,
 COALESCE(si.product_name_snapshot,spi.product_name_snapshot,pi.product_name_snapshot,ppi.product_name_snapshot,p.name) product,
 COALESCE(si.sku_snapshot,spi.sku_snapshot,pi.sku_snapshot,ppi.sku_snapshot,p.sku) sku,
 COALESCE(sh.invoice_no,sr.return_no,gh.grn_no,pr.return_no,a.adjustment_no) voucher,
 CASE m.source_type WHEN 'SALE' THEN 'sales' WHEN 'SALE_RETURN' THEN 'sales-returns'
 WHEN 'GRN' THEN 'grns' WHEN 'PURCHASE_RETURN' THEN 'purchase-returns' ELSE 'adjustments' END document_resource,
 COALESCE(sh.id,sr.id,gh.id,pr.id,a.id) document_id,
 COALESCE(sh.customer_id,ssh.customer_id) customer_id,COALESCE(po.supplier_id,ppo.supplier_id) supplier_id,
 COALESCE(c.name,sc.name,s.name,ps.name,'') party,
 COALESCE(si.unit_price,spi.unit_price) selling_rate,
 COALESCE(ssh.invoice_no,pgh.grn_no,po.purchase_no,a.reason,'') reference
 FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id
 LEFT JOIN sales_invoice_items si ON m.source_type='SALE' AND si.id=m.source_line_id
 LEFT JOIN sales_invoices sh ON sh.id=si.sales_invoice_id
 LEFT JOIN customers c ON c.id=sh.customer_id
 LEFT JOIN sales_return_items sri ON m.source_type='SALE_RETURN' AND sri.id=m.source_line_id
 LEFT JOIN sales_returns sr ON sr.id=sri.sales_return_id
 LEFT JOIN sales_invoice_items spi ON spi.id=sri.sales_invoice_item_id
 LEFT JOIN sales_invoices ssh ON ssh.id=spi.sales_invoice_id
 LEFT JOIN customers sc ON sc.id=ssh.customer_id
 LEFT JOIN goods_receipt_items gi ON m.source_type='GRN' AND gi.id=m.source_line_id
 LEFT JOIN goods_receipts gh ON gh.id=gi.goods_receipt_id
 LEFT JOIN purchase_items pi ON pi.id=gi.purchase_item_id
 LEFT JOIN purchases po ON po.id=pi.purchase_id
 LEFT JOIN suppliers s ON s.id=po.supplier_id
 LEFT JOIN purchase_return_items pri ON m.source_type='PURCHASE_RETURN' AND pri.id=m.source_line_id
 LEFT JOIN purchase_returns pr ON pr.id=pri.purchase_return_id
 LEFT JOIN goods_receipt_items pgi ON pgi.id=pri.goods_receipt_item_id
 LEFT JOIN goods_receipts pgh ON pgh.id=pgi.goods_receipt_id
 LEFT JOIN purchase_items ppi ON ppi.id=pgi.purchase_item_id
 LEFT JOIN purchases ppo ON ppo.id=ppi.purchase_id
 LEFT JOIN suppliers ps ON ps.id=ppo.supplier_id
 LEFT JOIN stock_adjustments a ON m.source_type='ADJUSTMENT' AND a.id=m.source_line_id
 WHERE m.product_id=? ${warehouse ? 'AND m.warehouse_id=?' : ''}
 AND ((m.source_type='SALE' AND sh.status='POSTED') OR
 (m.source_type='SALE_RETURN' AND sr.status='POSTED' AND ssh.status='POSTED' AND sri.saleable=1) OR
 (m.source_type='GRN' AND gh.status='POSTED') OR
 (m.source_type='PURCHASE_RETURN' AND pr.status='POSTED' AND pgh.status='POSTED') OR
 (m.source_type='ADJUSTMENT' AND a.status='POSTED'))
), physical_movements AS (
 SELECT m.*,GREATEST(quantity_delta_pcs,0) quantity_in,GREATEST(-quantity_delta_pcs,0) quantity_out,
 SUM(quantity_delta_pcs) OVER(ORDER BY occurred_at,id ROWS UNBOUNDED PRECEDING) running_quantity,
 SUM(quantity_delta_pcs) OVER(PARTITION BY warehouse_id ORDER BY occurred_at,id ROWS UNBOUNDED PRECEDING) warehouse_running_quantity,
 ROUND(quantity_delta_pcs*unit_cost,2) movement_cost
 FROM movement_sources m
)`;

module.exports = { salesCtes, purchaseCtes, movementCtes };
