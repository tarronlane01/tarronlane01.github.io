import { Link } from 'react-router-dom'

function Home() {
  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Tarron Lane Home">
          <img src="/t-icon.svg" alt="Tarron Lane Home" style={{ width: '2rem', height: '2rem' }} />
        </Link>
      </nav>
      <h1>Tarron Lane Homepage</h1>
      <nav>
        <ul>
          <li><Link to="/sql-test">SQL Test</Link></li>
          <li><Link to="/budget">Budget</Link></li>
          <li><Link to="/account">Account</Link></li>
        </ul>
      </nav>
    </div>
  )
}

export default Home

