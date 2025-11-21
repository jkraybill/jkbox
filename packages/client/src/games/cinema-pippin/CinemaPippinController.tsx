/**
 * Cinema Pippin - Controller Component (Player Phone)
 * Placeholder - Will be implemented in #52 (Answer Collection)
 */

import type { ControllerProps } from '@jkbox/shared'

export function CinemaPippinController({ playerId }: ControllerProps) {
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
				padding: '20px'
			}}
		>
			<h1 style={{ fontSize: '32px', marginBottom: '20px' }}>Cinema Pippin</h1>
			<p style={{ fontSize: '18px', color: '#aaa', textAlign: 'center' }}>
				Controller UI coming soon...
			</p>
			<p style={{ fontSize: '14px', color: '#666', marginTop: '20px' }}>Player: {playerId}</p>
		</div>
	)
}
