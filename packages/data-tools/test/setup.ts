import { beforeAll } from 'vitest'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

// SAFETY CHECK: Prevent running destructive setup against production DB
const SAFE_TEST_DB_PATTERNS = [
  /_test$/,
  /test_/,
  /jkbox_data_test/,
]

function isDatabaseSafeForTests(dbUrl: string | undefined): boolean {
  if (!dbUrl) return false

  // Extract database name from postgresql:///dbname or postgresql://host:port/dbname
  // Split on '/' and find the first non-empty segment after '//'
  const parts = dbUrl.split('/')
  const dbNameWithParams = parts.find((part, i) => i >= 2 && part && part !== '')
  if (!dbNameWithParams) return false

  // Remove query params (?host=...)
  const dbName = dbNameWithParams.split('?')[0]
  if (!dbName) return false

  return SAFE_TEST_DB_PATTERNS.some(pattern => pattern.test(dbName))
}

// Run once before all tests
beforeAll(async () => {
  if (!TEST_DATABASE_URL) {
    console.log('⚠️  TEST_DATABASE_URL not set - DB integration tests will be skipped')
    console.log('💡 Set TEST_DATABASE_URL to a test database to enable DB integration tests')
    return
  }

  // CRITICAL SAFETY CHECK
  if (!isDatabaseSafeForTests(TEST_DATABASE_URL)) {
    console.error('🚨 SAFETY CHECK FAILED!')
    console.error('🚨 Database name must contain "test" or end with "_test"')
    console.error(`🚨 Got: ${TEST_DATABASE_URL}`)
    console.error('🚨 DB integration tests will be skipped to protect production data')
    return
  }

  console.log('🔧 Setting up test database...')

  const pool = new Pool({ connectionString: TEST_DATABASE_URL })

  try {
    // Run setup script to create clean tables
    const setupSQL = readFileSync(
      join(__dirname, '../scripts/setup-test-db.sql'),
      'utf-8'
    )

    await pool.query(setupSQL)
    console.log('✅ Test database setup complete')
  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    throw error
  } finally {
    await pool.end()
  }
})
