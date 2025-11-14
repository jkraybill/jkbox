import { motion, AnimatePresence } from 'framer-motion'

interface CountdownProps {
  count: number
  gameName: string
  variant?: 'jumbotron' | 'player'
}

export function Countdown({ count, gameName, variant = 'player' }: CountdownProps) {
  const isJumbotron = variant === 'jumbotron'

  if (count === 0) {
    // Game starting animation
    return (
      <AnimatePresence>
        <motion.div
          style={isJumbotron ? styles.jumbotronContainer : styles.playerContainer}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            style={isJumbotron ? styles.jumbotronStartText : styles.playerStartText}
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: 1,
            }}
          >
            LET'S GO! 🎉
          </motion.div>
          <div style={isJumbotron ? styles.jumbotronGameName : styles.playerGameName}>
            {gameName}
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Countdown numbers (5, 4, 3, 2, 1)
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={count}
        style={isJumbotron ? styles.jumbotronContainer : styles.playerContainer}
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0, rotate: 180, opacity: 0 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20,
        }}
      >
        <motion.div
          style={isJumbotron ? styles.jumbotronNumber : styles.playerNumber}
          animate={{
            scale: [1, 1.2, 1],
            textShadow: [
              '0 0 20px rgba(255, 214, 0, 0.8)',
              '0 0 40px rgba(255, 214, 0, 1)',
              '0 0 20px rgba(255, 214, 0, 0.8)',
            ],
          }}
          transition={{
            duration: 0.5,
            repeat: 1,
          }}
        >
          {count}
        </motion.div>
        <div style={isJumbotron ? styles.jumbotronSubtitle : styles.playerSubtitle}>
          Get ready for {gameName}!
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

const styles = {
  // Player (mobile) styles
  playerContainer: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 1000,
  },
  playerNumber: {
    fontSize: 'var(--font-size-jumbo-5xl)',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    textShadow: 'var(--shadow-glow-yellow)',
    marginBottom: 'var(--space-2xl)',
  },
  playerSubtitle: {
    fontSize: 'var(--font-size-2xl)',
    color: 'var(--color-text-primary)',
    textAlign: 'center' as const,
  },
  playerStartText: {
    fontSize: 'var(--font-size-jumbo-3xl)',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    textShadow: 'var(--shadow-glow-yellow)',
    marginBottom: 'var(--space-xl)',
  },
  playerGameName: {
    fontSize: 'var(--font-size-3xl)',
    color: 'var(--color-primary-red)',
    fontWeight: 'bold',
  },

  // Jumbotron (TV) styles
  jumbotronContainer: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 1000,
  },
  jumbotronNumber: {
    fontSize: '256px',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    textShadow: 'var(--shadow-glow-yellow)',
    marginBottom: 'var(--space-3xl)',
    lineHeight: 1,
  },
  jumbotronSubtitle: {
    fontSize: 'var(--font-size-jumbo-3xl)',
    color: 'var(--color-text-primary)',
    textAlign: 'center' as const,
  },
  jumbotronStartText: {
    fontSize: '128px',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    textShadow: 'var(--shadow-glow-yellow)',
    marginBottom: 'var(--space-3xl)',
    lineHeight: 1,
  },
  jumbotronGameName: {
    fontSize: 'var(--font-size-jumbo-4xl)',
    color: 'var(--color-primary-red)',
    fontWeight: 'bold',
  },
}
