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
    >
      <div style={styles.icon}>⚙</div>
    </button>
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
    borderWidth: '0 0 80px 80px',
    padding: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    transition: 'border-color 0.2s ease',
    zIndex: 1000
  },
  tabClosed: {
    borderColor: 'transparent transparent #eab308 transparent' // yellow
  },
  tabOpen: {
    borderColor: 'transparent transparent #22c55e transparent' // green
  },
  icon: {
    position: 'absolute' as const,
    bottom: '8px',
    left: '8px',
    fontSize: '24px',
    color: '#ffffff',
    pointerEvents: 'none' as const
  }
}
