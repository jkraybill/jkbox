/**
 * Subtitle Downloader - Download subtitles from OpenSubtitles.com API
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-template-expressions */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
// @ts-expect-error - opensubtitles.com doesn't have type definitions
import OpenSubtitles from 'opensubtitles.com'

const OPENSUBTITLES_USER_AGENT = 'CinemaPippin v1.0'
const DURATION_TOLERANCE_SECONDS = 5 * 60 // 5 minutes in seconds

interface SubtitleSearchResult {
	found: boolean
	subtitlePath?: string
	error?: string
}

/**
 * Get video duration in seconds using ffprobe
 */
function getVideoDuration(videoPath: string): number {
	try {
		const output = execSync(
			`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
			{ encoding: 'utf-8' }
		)
		return parseFloat(output.trim())
	} catch (error: any) {
		throw new Error(`Failed to get video duration: ${error.message}`)
	}
}

/**
 * Get subtitle duration in seconds by parsing the last timestamp
 */
function getSubtitleDuration(subtitleContent: string): number {
	// SRT format: Find last timestamp
	// Example: 01:23:45,678 --> 01:23:48,901
	const timestampRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g
	const matches = [...subtitleContent.matchAll(timestampRegex)]

	if (matches.length === 0) {
		throw new Error('No valid SRT timestamps found in subtitle file')
	}

	// Get last timestamp's end time (second timestamp in the last match)
	const lastMatch = matches[matches.length - 1]
	const hours = parseInt(lastMatch[5], 10)
	const minutes = parseInt(lastMatch[6], 10)
	const seconds = parseInt(lastMatch[7], 10)
	const milliseconds = parseInt(lastMatch[8], 10)

	return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

/**
 * Validate that subtitle duration matches video duration (±5 minutes)
 */
function validateDuration(
	videoDuration: number,
	subtitleDuration: number
): { valid: boolean; error?: string } {
	const diff = Math.abs(videoDuration - subtitleDuration)

	if (diff > DURATION_TOLERANCE_SECONDS) {
		const videoMin = Math.floor(videoDuration / 60)
		const subtitleMin = Math.floor(subtitleDuration / 60)
		const diffMin = Math.floor(diff / 60)

		return {
			valid: false,
			error: `Duration mismatch: video=${videoMin}min, subtitle=${subtitleMin}min (diff=${diffMin}min, tolerance=5min)`
		}
	}

	return { valid: true }
}

/**
 * Calculate OpenSubtitles hash for a video file
 * This hash is used to find exact subtitle matches
 */
function calculateOpenSubtitlesHash(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunkSize = 65536 // 64k
		const fd = fs.openSync(filePath, 'r')
		const stats = fs.statSync(filePath)
		const fileSize = stats.size

		if (fileSize < chunkSize * 2) {
			fs.closeSync(fd)
			reject(new Error('File too small to calculate hash'))
			return
		}

		// Read first 64k
		const bufferStart = Buffer.alloc(chunkSize)
		fs.readSync(fd, bufferStart, 0, chunkSize, 0)

		// Read last 64k
		const bufferEnd = Buffer.alloc(chunkSize)
		fs.readSync(fd, bufferEnd, 0, chunkSize, fileSize - chunkSize)

		fs.closeSync(fd)

		// Calculate hash: filesize + sum of 64-bit ints from first/last 64k
		let hash = BigInt(fileSize)

		// Process first chunk
		for (let i = 0; i < chunkSize; i += 8) {
			hash += bufferStart.readBigUInt64LE(i)
		}

		// Process last chunk
		for (let i = 0; i < chunkSize; i += 8) {
			hash += bufferEnd.readBigUInt64LE(i)
		}

		// Convert to hex (16 chars, padded with zeros)
		const hashStr = (hash & BigInt('0xFFFFFFFFFFFFFFFF')).toString(16).padStart(16, '0')
		resolve(hashStr)
	})
}

/**
 * Extract movie name and year from filename
 *
 * Search strategy: Only use terms up to first year (19NN/20NN), replace hyphens with spaces
 * Example: "in-the-name-of-the-law-1949-1080p-bluray-x264-aac-yts-mx"
 *       -> "in the name of the law 1949"
 */
function parseFilename(filename: string): { movieName: string; year?: number } {
	// Remove extension
	const nameWithoutExt = path.basename(filename, path.extname(filename))

	// Find first year (4 digits, typically 1900-2099)
	const yearMatch = nameWithoutExt.match(/\b(19\d{2}|20\d{2})\b/)
	const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined

	// Extract everything up to (and including) the first year
	let movieName: string
	if (yearMatch && yearMatch.index !== undefined) {
		// Take substring from start to end of first year match
		movieName = nameWithoutExt.substring(0, yearMatch.index + yearMatch[0].length)
	} else {
		// No year found, use entire filename
		movieName = nameWithoutExt
	}

	// Replace hyphens, underscores, and dots with spaces
	movieName = movieName
		.replace(/[-_.]/g, ' ') // Replace separators with spaces
		.replace(/\s+/g, ' ') // Collapse multiple spaces
		.trim()

	return { movieName, year }
}

/**
 * Download subtitles for a video file
 */
export async function downloadSubtitles(
	videoPath: string,
	apiKey: string,
	username: string,
	password: string,
	language: string = 'en'
): Promise<SubtitleSearchResult> {
	console.log(`\n🔍 Searching subtitles for: ${path.basename(videoPath)}`)

	try {
		// Initialize OpenSubtitles client
		const os = new OpenSubtitles({
			apikey: apiKey,
			useragent: OPENSUBTITLES_USER_AGENT
		})

		// Login to get bearer token
		console.log(`   Logging in...`)
		try {
			await os.login({
				username: username,
				password: password
			})
		} catch (loginError: any) {
			console.error(`   ❌ Login failed: ${loginError.message}`)
			return { found: false, error: `Login failed: ${loginError.message}` }
		}

		// Calculate file hash for accurate matching
		let movieHash: string
		try {
			movieHash = await calculateOpenSubtitlesHash(videoPath)
			console.log(`   Hash: ${movieHash}`)
		} catch (error) {
			console.error(`   ⚠️  Could not calculate hash: ${error}`)
			return { found: false, error: 'Hash calculation failed' }
		}

		// Parse filename for fallback search
		const { movieName, year } = parseFilename(videoPath)
		console.log(`   Movie: ${movieName}${year ? ` (${year})` : ''}`)

		// Search by hash first (most accurate)
		console.log(`   Searching by hash...`)
		let searchResults = await os.subtitles({
			moviehash: movieHash,
			languages: language
		})

		// Fallback: search by filename if hash search fails
		if (!searchResults || !searchResults.data || searchResults.data.length === 0) {
			console.log(`   No results by hash, trying filename search...`)
			searchResults = await os.subtitles({
				query: movieName,
				languages: language
			})
		}

		if (!searchResults || !searchResults.data || searchResults.data.length === 0) {
			console.log(`   ❌ No subtitles found`)
			return { found: false, error: 'No subtitles found' }
		}

		// Get the best subtitle (first result is usually the best match)
		const bestSubtitle = searchResults.data[0]
		console.log(`   ✅ Found: ${bestSubtitle.attributes.release || 'Unknown release'}`)
		console.log(`   Language: ${bestSubtitle.attributes.language}`)
		console.log(`   Downloads: ${bestSubtitle.attributes.download_count}`)

		// Get download link
		const fileId = bestSubtitle.attributes.files[0].file_id
		console.log(`   Requesting download link...`)

		const downloadInfo = await os.download({
			file_id: fileId
		})

		if (!downloadInfo || !downloadInfo.link) {
			console.log(`   ❌ Could not get download link`)
			return { found: false, error: 'Download link unavailable' }
		}

		// Download subtitle file
		console.log(`   Downloading...`)
		const response = await fetch(downloadInfo.link)
		if (!response.ok) {
			throw new Error(`Download failed: ${response.statusText}`)
		}

		const subtitleContent = await response.text()

		// Validate duration before saving
		console.log(`   Validating duration...`)
		try {
			const videoDuration = getVideoDuration(videoPath)
			const subtitleDuration = getSubtitleDuration(subtitleContent)

			console.log(
				`   Video duration: ${Math.floor(videoDuration / 60)}min ${Math.floor(videoDuration % 60)}sec`
			)
			console.log(
				`   Subtitle duration: ${Math.floor(subtitleDuration / 60)}min ${Math.floor(subtitleDuration % 60)}sec`
			)

			const validation = validateDuration(videoDuration, subtitleDuration)
			if (!validation.valid) {
				console.log(`   ❌ ${validation.error}`)
				return { found: false, error: validation.error }
			}

			console.log(`   ✅ Duration match verified`)
		} catch (durationError: any) {
			console.error(`   ⚠️  Duration validation failed: ${durationError.message}`)
			console.log(`   ⚠️  Proceeding anyway (validation error, not mismatch)`)
			// Continue despite validation error - the subtitle might still be correct
		}

		// Save subtitle next to video file
		const subtitlePath = videoPath.replace(/\.[^.]+$/, '.srt')
		fs.writeFileSync(subtitlePath, subtitleContent, 'utf-8')

		console.log(`   ✅ Saved: ${path.basename(subtitlePath)}`)

		return { found: true, subtitlePath }
	} catch (error: any) {
		console.error(`   ❌ Error: ${error.message}`)

		// Check for rate limiting / quota exceeded (various error formats)
		const errorMsg = (error.message || '').toLowerCase()
		const errorString = JSON.stringify(error).toLowerCase()

		if (
			errorMsg.includes('406') ||
			errorMsg.includes('429') ||
			errorMsg.includes('rate limit') ||
			errorMsg.includes('quota') ||
			errorMsg.includes('download limit') ||
			errorMsg.includes('too many') ||
			errorString.includes('406') ||
			errorString.includes('quota') ||
			errorString.includes('download limit')
		) {
			return { found: false, error: 'QUOTA_EXCEEDED: Daily download limit reached (HTTP 406/429)' }
		}

		return { found: false, error: error.message || 'Unknown error' }
	}
}
