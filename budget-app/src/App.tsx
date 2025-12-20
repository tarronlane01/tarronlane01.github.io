import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SqlTest from './pages/SqlTest'
import Budget from './pages/Budget'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sql-test" element={<SqlTest />} />
        <Route path="/budget" element={<Budget />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
