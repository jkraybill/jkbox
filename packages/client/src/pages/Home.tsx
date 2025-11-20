import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../lib/use-socket'

export function Home() {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useSocket()
  const navigate = useNavigate()

  const handleCreateRoom = async () => {
    setIsCreating(true)
    setError(null)

    try {
      // Call server to create room
      const response = await fetch('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: 'temp-host-id' }) // Will be replaced with proper ID
      })

      if (!response.ok) {
        throw new Error('Failed to create room')
      }

      const { room } = await response.json()

      // Navigate to jumbotron view
      navigate(`/jumbotron/${room.roomId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
      setIsCreating(false)
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>jkbox</h1>
      <p style={styles.subtitle}>Party games for drunk friends with dark humor</p>

      <div style={styles.connectionStatus}>
        {isConnected ? (
          <span style={styles.connected}>● Connected</span>
        ) : (
          <span style={styles.disconnected}>● Connecting...</span>
        )}
      </div>

      <button
        onClick={handleCreateRoom}
        disabled={!isConnected || isCreating}
        style={{
          ...styles.button,
          ...((!isConnected || isCreating) && styles.buttonDisabled)
        }}
      >
        {isCreating ? 'Creating Party...' : 'Create Party'}
      </button>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.footer}>
        <p>Session 2 - Lobby MVP</p>
        <p style={styles.versionInfo}>v0.1.0</p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    backgroundColor: '#1a1a1a',
    color: '#ffffff'
  },
  title: {
    fontSize: '72px',
    margin: '0 0 10px 0',
    fontWeight: 'bold'
  },
  subtitle: {
    fontSize: '18px',
    margin: '0 0 40px 0',
    color: '#aaaaaa'
  },
  connectionStatus: {
    marginBottom: '20px',
    fontSize: '14px'
  },
  connected: {
    color: '#4ade80'
  },
  disconnected: {
    color: '#f87171'
  },
  button: {
    fontSize: '24px',
    padding: '20px 60px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  },
  buttonDisabled: {
    backgroundColor: '#4b5563',
    cursor: 'not-allowed'
  },
  error: {
    marginTop: '20px',
    padding: '12px 24px',
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    borderRadius: '8px'
  },
  footer: {
    position: 'absolute' as const,
    bottom: '20px',
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#666666'
  },
  versionInfo: {
    margin: '5px 0 0 0'
  }
}
