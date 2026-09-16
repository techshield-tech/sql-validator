// Representative sample SQL for the "Load sample" action. Deliberately
// exercises every lint rule at least once, across several statements, so
// loading it demonstrates the whole tool. Tool-specific.

export const SAMPLE_SQL = `SELECT * FROM customers, orders
WHERE customers.id = orders.customer_id;

SELECT id, email FROM customers
WHERE status = 'active'
LIMIT 50;

UPDATE customers SET status = 'inactive';

DELETE FROM orders WHERE notes = NULL;

SELECT * FROM products WHERE name LIKE '%widget';
`;
