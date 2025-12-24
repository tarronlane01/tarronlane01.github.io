import { Link } from 'react-router-dom'
import { DropdownMenu, type MenuItem } from '../components/ui'

function SqlTest() {
  const setupCode = `ALTER TABLE shippings
ADD order_id INT;

UPDATE shippings
SET order_id = CASE
  WHEN shipping_id = 1 THEN 5
    WHEN shipping_id = 2 THEN 1
    WHEN shipping_id = 3 THEN 3
    WHEN shipping_id = 4 THEN 6
    WHEN shipping_id = 5 THEN 4
END
WHERE shipping_id IN (1,2,3,4,5);

INSERT INTO shippings (shipping_id, status, customer, order_id)
VALUES (6, "Cancelled", 4, 2);

INSERT INTO orders (order_id, item, amount, customer_id)
VALUES (6, "Monitor", 800, 5);`

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ opacity: 0.6, fontSize: '1.5rem', textDecoration: 'none', padding: '0.25rem 0.5rem' }} title="Back to Home">←</Link>
        </div>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }} title="Tarron Lane Home">
          <img src="/t-icon.svg" alt="Tarron Lane" style={{ width: '1.5rem', height: '1.5rem' }} />
          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>SQL Test</span>
        </Link>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <DropdownMenu items={[
            { label: 'Budget', icon: '💰', to: '/budget' },
            { label: 'Account', icon: '👤', to: '/account' },
          ] as MenuItem[]} />
        </div>
      </nav>

      <h1>SQL Test</h1>

      <h2>Setup</h2>

      <h3>1. Open up your preferred web browser to <a href="https://www.programiz.com/sql/online-compiler/" target="_blank" rel="noopener noreferrer">https://www.programiz.com/sql/online-compiler/</a></h3>
      <ul>
        <li>This is a basic online sql query editor</li>
        <li>It will include three tables: <b>"Customer"</b>, <b>"Orders"</b>, and <b>"Shippings"</b></li>
      </ul>

      <h3>2. Run the below query block inside the online editor to make some updates to the schema.</h3>

      <pre style={{ backgroundColor: '#1a1a1a', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
        <code>{setupCode}</code>
      </pre>

      <h2>SQL Problems</h2>

      <p>Write queries in the online editor to answer these questions.</p>

      <h3>Question #1</h3>

      <p>Calculate the total number of orders, the total $ amount, and the total items "delivered" by Country. Show the following columns: country, order count, total $ amount, and total delivered. Order by total $ amount largest to smallest.</p>

      <h3>Question #2</h3>

      <p>Find the customers who have placed orders with the HIGHEST total amount for each country. One record per country. Display the customer's first name, last name, country, and the corresponding highest total order amount. Also include the shipping status of the associated order.</p>
    </div>
  )
}

export default SqlTest
