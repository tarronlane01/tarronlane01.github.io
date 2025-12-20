import { Link } from 'react-router-dom'

function Home() {
  return (
    <div>
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

