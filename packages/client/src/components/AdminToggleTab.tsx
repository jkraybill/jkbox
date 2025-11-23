interface AdminToggleTabProps {
	isOpen: boolean
	onClick: () => void
}

export function AdminToggleTab({ isOpen, onClick }: AdminToggleTabProps) {
	return (
		<button
			onClick={onClick}
			style={{
				...styles.tab,
				...(isOpen ? styles.tabOpen : styles.tabClosed)
			}}
			aria-label={isOpen ? 'Close admin tools' : 'Open admin tools'}
		/>
	)
}

const styles = {
	tab: {
		position: 'fixed' as const,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		border: 'none',
		cursor: 'pointer',
		borderStyle: 'solid',
		borderWidth: '80px 0 0 80px',
		padding: 0,
		display: 'flex',
		alignItems: 'flex-end',
		justifyContent: 'flex-start',
		transition: 'border-color 0.2s ease',
		zIndex: 1000
	},
	tabClosed: {
		borderColor: 'transparent transparent transparent #eab308' // yellow
	},
	tabOpen: {
		borderColor: 'transparent transparent transparent #22c55e' // green
	}
}
