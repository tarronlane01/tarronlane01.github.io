import { Link } from 'react-router-dom'

function Home() {
  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <h1>Welcome</h1>
      <nav>
        <ul>
          <li><Link to="/sql-test">SQL Test</Link></li>
          <li><Link to="/budget">Budget</Link></li>
        </ul>
      </nav>
    </div>
  )
}

export default Home

