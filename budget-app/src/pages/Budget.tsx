import { Link } from 'react-router-dom'

function Budget() {
  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav>
        <Link to="/">← Back to Home</Link>
      </nav>
      <h1>Budget</h1>
      <p>Budget content coming soon...</p>
    </div>
  )
}

export default Budget

