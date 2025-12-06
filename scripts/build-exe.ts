#!/usr/bin/env bun
/**
 * Build jkbox as a standalone Windows executable
 *
 * This script:
 * 1. Builds the React client with Vite
 * 2. Compiles the server + client into a single .exe using Bun
 *
 * Usage: bun run scripts/build-exe.ts
 */

import { $ } from 'bun'
import { existsSync, mkdirSync, cpSync, rmSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLIENT_DIR = resolve(ROOT, 'packages/client')
const SERVER_DIR = resolve(ROOT, 'packages/server')
const BUILD_DIR = resolve(ROOT, 'build')
const DIST_DIR = resolve(BUILD_DIR, 'jkbox-windows')

console.log('🎮 Building jkbox for Windows...\n')

// Step 1: Clean build directory
console.log('🧹 Cleaning build directory...')
if (existsSync(BUILD_DIR)) {
  rmSync(BUILD_DIR, { recursive: true })
}
mkdirSync(DIST_DIR, { recursive: true })

// Step 2: Build client with Vite
console.log('📦 Building React client...')
await $`cd ${CLIENT_DIR} && npm run build`

// Step 3: Copy client dist to build folder
console.log('📋 Copying client assets...')
const clientDist = resolve(CLIENT_DIR, 'dist')
const clientTarget = resolve(DIST_DIR, 'client-dist')
cpSync(clientDist, clientTarget, { recursive: true })

// Step 4: Build shared package
console.log('📦 Building shared package...')
await $`cd ${resolve(ROOT, 'packages/shared')} && npm run build`

// Step 5: Compile server with Bun
console.log('🔨 Compiling server with Bun...')
const serverEntry = resolve(SERVER_DIR, 'src/index.ts')
const exeOutput = resolve(DIST_DIR, 'jkbox-server.exe')

await $`bun build --compile --target=bun-windows-x64 ${serverEntry} --outfile ${exeOutput}`

// Step 6: Copy necessary assets
console.log('📋 Copying assets...')

// Create clean .env file with just ANTHROPIC_API_KEY
const envContent = `# jkbox Party Server Configuration
#
# REQUIRED: Get your API key from https://console.anthropic.com/
# The game uses Claude AI to generate funny answers and judge submissions.
#
ANTHROPIC_API_KEY=YOUR_API_KEY_HERE
`
await Bun.write(resolve(DIST_DIR, '.env'), envContent)
console.log('✓ Created .env file (needs API key)')

// Step 8: Copy video clips
const clipsSource = resolve(ROOT, 'generated/clips')
const clipsTarget = resolve(DIST_DIR, 'clips')

if (existsSync(clipsSource)) {
  console.log('🎬 Copying video clips (this may take a while)...')
  cpSync(clipsSource, clipsTarget, { recursive: true })
  console.log('✓ Video clips copied')
} else {
  console.warn('⚠️  No clips folder found at generated/clips')
  console.warn('   You will need to copy clips manually to the clips/ folder')
}

// Step 9: Copy constraints.txt for AI players
const constraintsSource = resolve(ROOT, 'assets/constraints.txt')
if (existsSync(constraintsSource)) {
  cpSync(constraintsSource, resolve(DIST_DIR, 'constraints.txt'))
  console.log('✓ Constraints file copied')
} else {
  console.warn('⚠️  No constraints.txt found at assets/constraints.txt')
}

// Create README for distribution
const readmeContent = `# jkbox Party Server - Cinema Pippin

## IMPORTANT: First-Time Setup

Before running the game, you MUST configure your API key:

1. Open the .env file in this folder (using Notepad or any text editor)
2. Replace YOUR_API_KEY_HERE with your actual Anthropic API key
3. Save the file

To get an API key:
- Go to https://console.anthropic.com/
- Create an account or sign in
- Go to API Keys and create a new key
- Copy the key and paste it in the .env file

## Running the Game

1. Double-click "jkbox-server.exe"
2. A console window will open showing the server starting
3. Open a web browser on your TV/main display computer
4. Go to http://localhost:3001
5. The TV will show a QR code
6. Players scan the QR code with their phones to join!

## Troubleshooting

- "API key not configured" error: Edit the .env file and add your key
- "Insufficient credits" error: Add credits at console.anthropic.com/settings/billing
- QR code not working: Players can manually go to http://<your-computer-ip>:3001
- Make sure all players are on the same WiFi network

## About

Cinema Pippin is a party game where players fill in movie subtitles with
funny answers. An AI generates additional answers and judges submissions.

Have fun! 🎬🐕
`

await Bun.write(resolve(DIST_DIR, 'README.txt'), readmeContent)

console.log('\n✅ Build complete!')
console.log(`📁 Output: ${DIST_DIR}`)
console.log('\nContents:')
console.log('  - jkbox-server.exe  (double-click to run)')
console.log('  - client-dist/      (web UI assets)')
console.log('  - clips/            (video clips)')
console.log('  - constraints.txt   (AI player constraints)')
console.log('  - .env              (API key config)')
console.log('  - README.txt        (instructions)')
console.log('\n🎉 Zip the jkbox-windows folder and ship it!')
