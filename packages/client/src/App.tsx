import { Routes, Route } from 'react-router-dom'
import { Jumbotron } from './pages/Jumbotron'
import { Join } from './pages/Join'
import { Player } from './pages/Player'

function App() {
	return (
		<Routes>
			<Route path="/" element={<Jumbotron />} />
			<Route path="/join" element={<Join />} />
			<Route path="/play" element={<Player />} />
		</Routes>
	)
}

export default App
