#!/usr/bin/env node
import 'dotenv/config'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import axios from 'axios'
import chalk from 'chalk'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const REDIRECT_URI = 'http://localhost:8080/callback'
const PORT = 8080

/**
 * Reddit OAuth Authorization Flow
 *
 * This implements the proper OAuth 2.0 authorization code flow:
 * 1. User authorizes app in browser
 * 2. Reddit redirects back with auth code
 * 3. Exchange auth code for access + refresh tokens
 * 4. Save refresh token to .env (never expires)
 */

async function main() {
  console.log(chalk.blue('🔐 Reddit OAuth Authorization\n'))

  // Check required env vars
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.log(chalk.red('❌ Missing Reddit credentials in .env:'))
    console.log(chalk.gray('   REDDIT_CLIENT_ID=your_client_id'))
    console.log(chalk.gray('   REDDIT_CLIENT_SECRET=your_client_secret\n'))
    console.log(chalk.yellow('Create an app at: https://www.reddit.com/prefs/apps'))
    console.log(chalk.yellow('  - Select "web app" (not "script")'))
    console.log(chalk.yellow(`  - Set redirect URI: ${REDIRECT_URI}\n`))
    process.exit(1)
  }

  console.log(chalk.green('✓ Reddit credentials found\n'))

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(7)

  // Build authorization URL
  const authUrl = new URL('https://www.reddit.com/api/v1/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('duration', 'permanent') // Get refresh token
  authUrl.searchParams.set('scope', 'read history') // Minimal permissions needed

  console.log(chalk.yellow('📋 Step 1: Authorize the app'))
  console.log(chalk.white('\nOpen this URL in your browser:\n'))
  console.log(chalk.cyan(authUrl.toString()))
  console.log(chalk.white('\n'))

  // Start local server to receive callback
  let server: ReturnType<typeof createServer> | null = null

  const authPromise = new Promise<string>((resolve, reject) => {
    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`)

      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      // Get authorization code from callback
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>❌ Authorization failed</h1><p>You can close this window.</p>')
        reject(new Error(`Reddit authorization error: ${error}`))
        return
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<h1>❌ Invalid callback</h1><p>Missing code or state mismatch.</p>')
        reject(new Error('Invalid OAuth callback'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>✅ Authorization successful!</h1><p>You can close this window and return to the terminal.</p>')

      resolve(code)
    })

    server.listen(PORT, () => {
      console.log(chalk.gray(`Waiting for authorization... (server listening on port ${PORT})\n`))
    })
  })

  try {
    // Wait for authorization code
    const authCode = await authPromise

    console.log(chalk.green('✓ Authorization code received\n'))
    console.log(chalk.yellow('📋 Step 2: Exchange code for tokens'))

    // Exchange authorization code for tokens
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenResponse = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'jkbox-data-collector/0.1.0',
        },
      }
    )

    const accessToken = tokenResponse.data.access_token
    const refreshToken = tokenResponse.data.refresh_token
    const expiresIn = tokenResponse.data.expires_in

    console.log(chalk.green('✓ Tokens received'))
    console.log(chalk.gray(`  Access token expires in: ${expiresIn} seconds`))
    console.log(chalk.gray(`  Refresh token: ${refreshToken.substring(0, 20)}...\n`))

    console.log(chalk.yellow('📋 Step 3: Save refresh token to .env'))

    // Update .env file
    const envPath = join(process.cwd(), '.env')
    let envContent = readFileSync(envPath, 'utf-8')

    // Check if REDDIT_REFRESH_TOKEN already exists
    if (envContent.includes('REDDIT_REFRESH_TOKEN=')) {
      // Replace existing token
      envContent = envContent.replace(
        /REDDIT_REFRESH_TOKEN=.*/,
        `REDDIT_REFRESH_TOKEN=${refreshToken}`
      )
    } else {
      // Add new token after client secret
      envContent = envContent.replace(
        /REDDIT_CLIENT_SECRET=.*/,
        `REDDIT_CLIENT_SECRET=${clientSecret}\nREDDIT_REFRESH_TOKEN=${refreshToken}`
      )
    }

    // Remove username/password if present
    envContent = envContent.replace(/REDDIT_USERNAME=.*\n/, '')
    envContent = envContent.replace(/REDDIT_PASSWORD=.*\n/, '')

    writeFileSync(envPath, envContent)

    console.log(chalk.green('✓ Refresh token saved to .env'))
    console.log(chalk.white('\n🎉 OAuth setup complete!'))
    console.log(chalk.gray('\nYou can now run:'))
    console.log(chalk.cyan('  npm run collect-reddit -- --limit 1000 --min-score 100\n'))

  } catch (error) {
    console.error(chalk.red(`\n❌ OAuth failed: ${error}`))
    process.exit(1)
  } finally {
    server?.close()
  }
}

main()
