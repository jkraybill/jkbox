import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Jumbotron } from './pages/Jumbotron'
import { Join } from './pages/Join'
import { Player } from './pages/Player'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/jumbotron" element={<Jumbotron />} />
      <Route path="/join/:roomId" element={<Join />} />
      <Route path="/play/:roomId" element={<Player />} />
    </Routes>
  )
}

export default App
