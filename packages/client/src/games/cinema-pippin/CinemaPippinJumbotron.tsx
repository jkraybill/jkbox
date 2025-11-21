/**
 * Cinema Pippin - Jumbotron Component (TV Display)
 * Placeholder - Will be implemented in #51 (Video Playback)
 */

import type { JumbotronProps } from '@jkbox/shared'

export function CinemaPippinJumbotron({ players }: JumbotronProps) {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				minHeight: '100vh',
				backgroundColor: '#1a1a1a',
				color: '#ffffff',
				padding: '40px'
			}}
		>
			<h1 style={{ fontSize: '64px', marginBottom: '40px' }}>Cinema Pippin</h1>
			<p style={{ fontSize: '32px', color: '#aaa' }}>Implementation in progress...</p>
			<div style={{ marginTop: '40px' }}>
				<h2>Players: {players.length}</h2>
			</div>
		</div>
	)
}
