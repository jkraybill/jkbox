#!/usr/bin/env node

/**
 * Search IMDB datasets for low-rated non-English movies from 1969-1999
 *
 * Downloads and queries IMDB's public datasets:
 * - title.basics.tsv.gz (movie metadata)
 * - title.ratings.tsv.gz (ratings and vote counts)
 *
 * Criteria:
 * - Rating: 3.0-4.9
 * - Language: NOT English (detected via common film title words)
 * - Year: 1969-1999
 * - Vote count: 100-1000
 * - Runtime: >= 80 minutes
 *
 * Output: 20 movies per language (sorted by language name, then year ascending)
 */

import { createWriteStream, existsSync, readFileSync, createReadStream, mkdirSync } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { get } from 'https';
import { detectLanguageFromTitle } from './film-language-data.js';

const DATASETS_DIR = '/tmp/imdb-datasets';
const BASICS_URL = 'https://datasets.imdbws.com/title.basics.tsv.gz';
const RATINGS_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';

interface MovieBasics {
  tconst: string;
  titleType: string;
  primaryTitle: string;
  originalTitle: string;
  isAdult: string;
  startYear: string;
  endYear: string;
  runtimeMinutes: string;
  genres: string;
}

interface MovieRating {
  tconst: string;
  averageRating: string;
  numVotes: string;
}

interface MatchedMovie {
  id: string;
  title: string;
  originalTitle: string;
  year: number;
  rating: number;
  votes: number;
  genres: string;
  language: string;
}

/**
 * Download a file from URL with progress indicator
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\nDownloading ${url}...`);

    get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      let lastPercent = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);

        if (percent > lastPercent && percent % 10 === 0) {
          process.stdout.write(`  ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)\r`);
          lastPercent = percent;
        }
      });

      const fileStream = createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`  ✓ Downloaded to ${destPath}\n`);
        resolve();
      });

      fileStream.on('error', (err) => {
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse TSV line into object
 */
function parseTsvLine(line: string, headers: string[]): Record<string, string> {
  const values = line.split('\t');
  const obj: Record<string, string> = {};

  headers.forEach((header, index) => {
    obj[header] = values[index] || '';
  });

  return obj;
}

/**
 * Read and filter title.ratings.tsv.gz
 * Returns a Map of tconst -> rating data for movies matching vote count criteria
 */
async function loadRatings(ratingsPath: string): Promise<Map<string, MovieRating>> {
  console.log('\n📊 Loading ratings data...');

  const ratings = new Map<string, MovieRating>();
  const gunzip = createGunzip();
  const fileStream = createReadStream(ratingsPath);

  fileStream.pipe(gunzip);

  const rl = createInterface({
    input: gunzip,
    crlfDelay: Infinity
  });

  let isFirstLine = true;
  let headers: string[] = [];
  let totalCount = 0;
  let matchedCount = 0;

  for await (const line of rl) {
    if (isFirstLine) {
      headers = line.split('\t');
      isFirstLine = false;
      continue;
    }

    totalCount++;
    if (totalCount % 100000 === 0) {
      process.stdout.write(`  Processed ${totalCount.toLocaleString()} ratings (matched: ${matchedCount.toLocaleString()})\r`);
    }

    const data = parseTsvLine(line, headers) as MovieRating;
    const rating = parseFloat(data.averageRating);
    const votes = parseInt(data.numVotes, 10);

    // Filter: rating 3.0-4.9, votes 100-1000
    if (rating >= 3.0 && rating <= 4.9 && votes >= 100 && votes <= 1000) {
      ratings.set(data.tconst, data);
      matchedCount++;
    }
  }

  console.log(`\n  ✓ Loaded ${matchedCount.toLocaleString()} ratings matching criteria (from ${totalCount.toLocaleString()} total)\n`);

  return ratings;
}

/**
 * Detect language from original title using word-based lookup
 * Uses common film title words translated into 30 languages
 */
function detectLanguage(originalTitle: string): string {
  const detected = detectLanguageFromTitle(originalTitle);
  return detected || 'Unknown';
}

/**
 * Read and filter title.basics.tsv.gz
 * Cross-references with ratings data
 */
async function findMatchingMovies(
  basicsPath: string,
  ratingsMap: Map<string, MovieRating>
): Promise<MatchedMovie[]> {
  console.log('\n🎬 Searching for matching movies...');

  const matches: MatchedMovie[] = [];
  const gunzip = createGunzip();
  const fileStream = createReadStream(basicsPath);

  fileStream.pipe(gunzip);

  const rl = createInterface({
    input: gunzip,
    crlfDelay: Infinity
  });

  let isFirstLine = true;
  let headers: string[] = [];
  let totalCount = 0;
  let processedCount = 0;

  for await (const line of rl) {
    if (isFirstLine) {
      headers = line.split('\t');
      isFirstLine = false;
      continue;
    }

    totalCount++;
    if (totalCount % 100000 === 0) {
      process.stdout.write(`  Processed ${totalCount.toLocaleString()} titles (matched: ${matches.length})\r`);
    }

    const data = parseTsvLine(line, headers) as MovieBasics;

    // Filter: must be a movie
    if (data.titleType !== 'movie') continue;

    // Filter: must have rating data
    const ratingData = ratingsMap.get(data.tconst);
    if (!ratingData) continue;

    // Filter: year 1969-1999
    const year = parseInt(data.startYear, 10);
    if (isNaN(year) || year < 1969 || year > 1999) continue;

    // Filter: not adult content
    if (data.isAdult === '1') continue;

    // Filter: runtime >= 80 minutes
    const runtime = parseInt(data.runtimeMinutes, 10);
    if (isNaN(runtime) || runtime < 80) continue;

    processedCount++;

    // Detect language from original title
    const language = detectLanguage(data.originalTitle);

    // Skip if we couldn't detect a language, or if it's English
    if (!language || language === 'Unknown' || language === 'English') {
      continue;
    }

    const rating = parseFloat(ratingData.averageRating);
    const votes = parseInt(ratingData.numVotes, 10);

    matches.push({
      id: data.tconst,
      title: data.primaryTitle,
      originalTitle: data.originalTitle,
      year,
      rating,
      votes,
      genres: data.genres.replace(/,/g, ', '),
      language
    });
  }

  console.log(`\n  ✓ Found ${matches.length} matching movies\n`);

  return matches;
}

/**
 * Main function
 */
async function main() {
  console.log('================================================================================');
  console.log('🎬 IMDB LOW-RATED NON-ENGLISH MOVIE FINDER (1969-1999)');
  console.log('================================================================================');
  console.log('\nCriteria:');
  console.log('  • Rating: 3.0-4.9');
  console.log('  • Language: Non-English (detected via common title words)');
  console.log('  • Year: 1969-1999');
  console.log('  • Vote count: 100-1000');
  console.log('  • Runtime: >= 80 minutes');
  console.log('  • Output: 20 per language (sorted by language, then year)');
  console.log('================================================================================\n');

  // Ensure datasets directory exists
  if (!existsSync(DATASETS_DIR)) {
    mkdirSync(DATASETS_DIR, { recursive: true });
  }

  const basicsPath = `${DATASETS_DIR}/title.basics.tsv.gz`;
  const ratingsPath = `${DATASETS_DIR}/title.ratings.tsv.gz`;

  // Download datasets if not cached
  if (!existsSync(ratingsPath)) {
    await downloadFile(RATINGS_URL, ratingsPath);
  } else {
    console.log(`\n✓ Using cached ratings: ${ratingsPath}`);
  }

  if (!existsSync(basicsPath)) {
    await downloadFile(BASICS_URL, basicsPath);
  } else {
    console.log(`✓ Using cached basics: ${basicsPath}`);
  }

  // Load and filter data
  const ratingsMap = await loadRatings(ratingsPath);
  const matches = await findMatchingMovies(basicsPath, ratingsMap);

  // Group by language
  console.log('📋 Grouping by language...\n');
  const byLanguage = new Map<string, MatchedMovie[]>();

  for (const movie of matches) {
    if (!byLanguage.has(movie.language)) {
      byLanguage.set(movie.language, []);
    }
    byLanguage.get(movie.language)!.push(movie);
  }

  // Sort each language group by year (ascending) and take top 20
  const results: MatchedMovie[] = [];

  for (const [language, movies] of byLanguage.entries()) {
    movies.sort((a, b) => a.year - b.year);
    const top20 = movies.slice(0, 20);
    results.push(...top20);
  }

  // Sort final results by language name, then year
  results.sort((a, b) => {
    if (a.language !== b.language) {
      return a.language.localeCompare(b.language);
    }
    return a.year - b.year;
  });

  // Output results
  console.log('================================================================================');
  console.log('📊 RESULTS');
  console.log('================================================================================\n');
  console.log(`Found ${byLanguage.size} languages with ${results.length} total movies:\n`);

  let currentLanguage = '';
  for (const movie of results) {
    if (movie.language !== currentLanguage) {
      currentLanguage = movie.language;
      console.log(`\n${currentLanguage}:`);
      console.log('─'.repeat(80));
    }

    console.log(`  ${movie.rating.toFixed(1)} ⭐ | ${movie.year} | ${movie.title}`);
    if (movie.originalTitle !== movie.title) {
      console.log(`         | Original: ${movie.originalTitle}`);
    }
    console.log(`         | ${movie.votes} votes | ${movie.genres}`);
    console.log(`         | IMDB: https://www.imdb.com/title/${movie.id}/`);
  }

  console.log('\n================================================================================');
  console.log(`✅ Complete! Found ${results.length} movies across ${byLanguage.size} languages`);
  console.log('================================================================================\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
