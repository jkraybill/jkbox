import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface PippinProps {
  variant?: 'intro' | 'corner' | 'fullscreen'
  onIntroComplete?: () => void
}

export function Pippin({ variant = 'corner', onIntroComplete }: PippinProps) {
  const [showIntro, setShowIntro] = useState(variant === 'intro')

  useEffect(() => {
    if (variant === 'intro') {
      // Jack-in-the-box intro plays for 3 seconds
      const timer = setTimeout(() => {
        setShowIntro(false)
        onIntroComplete?.()
      }, 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [variant, onIntroComplete])

  // Jack-in-the-box intro animation
  if (showIntro && variant === 'intro') {
    return (
      <AnimatePresence>
        <motion.div
          style={styles.introContainer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            style={styles.introBox}
            initial={{ scale: 0, rotate: -180 }}
            animate={{
              scale: [0, 1.2, 0.9, 1.1, 1],
              rotate: [0, 10, -10, 5, 0],
            }}
            transition={{
              duration: 1.5,
              times: [0, 0.3, 0.5, 0.7, 1],
              ease: 'easeOut',
            }}
          >
            <motion.img
              src="/pippin.png"
              alt="Pippin the Moodle"
              style={styles.introImage}
              animate={{
                y: [0, -20, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            />
            <motion.div
              style={styles.introText}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <h1 style={styles.introTitle}>WELCOME TO PIPPIN'S PLAYHOUSE!</h1>
              <p style={styles.introSubtitle}>Let's get this party started! 🐾</p>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Corner mascot with idle animations
  if (variant === 'corner') {
    return (
      <motion.div
        style={styles.cornerContainer}
        animate={{
          rotate: [0, 5, -5, 0],
          y: [0, -10, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      >
        <motion.img
          src="/pippin.png"
          alt="Pippin the Moodle"
          style={styles.cornerImage}
          whileHover={{ scale: 1.1, rotate: 10 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    )
  }

  return null
}

const styles = {
  introContainer: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 9999,
  },
  introBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 'var(--space-3xl)',
  },
  introImage: {
    width: '400px',
    height: '400px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(var(--shadow-glow-yellow-soft))',
  },
  introText: {
    textAlign: 'center' as const,
  },
  introTitle: {
    fontSize: 'var(--font-size-jumbo-5xl)',
    fontWeight: 'bold',
    color: 'var(--color-primary-yellow)',
    textShadow: 'var(--shadow-glow-yellow)',
    margin: 0,
    marginBottom: 'var(--space-xl)',
  },
  introSubtitle: {
    fontSize: 'var(--font-size-jumbo-2xl)',
    color: 'var(--color-primary-red)',
    margin: 0,
  },
  cornerContainer: {
    position: 'fixed' as const,
    bottom: 'var(--space-3xl)',
    right: 'var(--space-3xl)',
    zIndex: 100,
  },
  cornerImage: {
    width: '180px',
    height: '180px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(var(--shadow-default))',
    cursor: 'pointer',
  },
}
