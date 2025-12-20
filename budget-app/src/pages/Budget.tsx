import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import app from '../firebase'

function Budget() {
  const [testDoc, setTestDoc] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const db = getFirestore(app)
    const docRef = doc(db, 'test', 'test')

    getDoc(docRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          setTestDoc(docSnap.data())
        } else {
          setError('Document not found')
        }
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2rem' }}>
      <nav>
        <Link to="/">← Back to Home</Link>
      </nav>
      <h1>Budget</h1>

      <h2>Test Document</h2>
      {loading && <p>Loading document...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {testDoc && (
        <pre style={{
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          padding: '1rem',
          borderRadius: '4px'
        }}>
          {JSON.stringify(testDoc, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default Budget

