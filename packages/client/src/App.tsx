import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>jkbox - Coming soon</div>} />
      <Route path="/jumbotron/:roomId" element={<div>Jumbotron view</div>} />
      <Route path="/play/:roomId" element={<div>Player view</div>} />
    </Routes>
  )
}

export default App
