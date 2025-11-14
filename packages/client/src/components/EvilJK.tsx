import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface EvilJKProps {
  variant?: 'intro' | 'corner' | 'fullscreen'
  onIntroComplete?: () => void
}

export function EvilJK({ variant = 'corner', onIntroComplete }: EvilJKProps) {
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
              src="/eviljk.jpg"
              alt="Evil JK"
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
              <h1 style={styles.introTitle}>WELCOME TO JKBOX!</h1>
              <p style={styles.introSubtitle}>Let's get this party started! 😈</p>
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
          src="/eviljk.jpg"
          alt="Evil JK"
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
    gap: '40px',
  },
  introImage: {
    width: '400px',
    height: '400px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 0 40px rgba(255, 214, 0, 0.6))',
  },
  introText: {
    textAlign: 'center' as const,
  },
  introTitle: {
    fontSize: '72px',
    fontWeight: 'bold',
    color: '#FFD600',
    textShadow: '0 0 20px rgba(255, 214, 0, 0.8), 0 0 40px rgba(255, 23, 68, 0.6)',
    margin: 0,
    marginBottom: '20px',
  },
  introSubtitle: {
    fontSize: '36px',
    color: '#FF1744',
    margin: 0,
  },
  cornerContainer: {
    position: 'fixed' as const,
    bottom: '40px',
    right: '40px',
    zIndex: 100,
  },
  cornerImage: {
    width: '180px',
    height: '180px',
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5))',
    cursor: 'pointer',
  },
}
