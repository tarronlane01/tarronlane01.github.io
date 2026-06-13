import { Routes, Route } from 'react-router-dom'
import { PackingProvider } from '@packing/contexts'
import PackingLayout from '@packing/PackingLayout'
import Trips from '@packing/pages/Trips'
import Settings from '@packing/pages/Settings'
import MasterList from '@packing/pages/MasterList'
import TripDetail from '@packing/pages/TripDetail'

function PackingRoutes() {
  return (
    <Routes>
      <Route element={<PackingLayout />}>
        <Route index element={<Trips />} />
        <Route path="settings" element={<Settings />} />
        <Route path="master-list" element={<MasterList />} />
        <Route path="trip/:tripId" element={<TripDetail />} />
      </Route>
    </Routes>
  )
}

export default function PackingApp() {
  return (
    <PackingProvider>
      <PackingRoutes />
    </PackingProvider>
  )
}
