/**
 * Internet Archive Wayback Machine integration
 * Fetches historical RSS feed snapshots for deep collection (up to 10 years back)
 */

import axios from 'axios'

export interface WaybackSnapshot {
  timestamp: string // YYYYMMDDHHMMSS format
  url: string
  status: string
}

export interface WaybackCDXResult {
  urlkey: string
  timestamp: string
  original: string
  mimetype: string
  statuscode: string
  digest: string
  length: string
}

/**
 * Fetches all available snapshots of a URL from Wayback Machine
 * Can retrieve thousands of historical captures
 */
export class WaybackFetcher {
  private readonly cdxApiUrl = 'https://web.archive.org/cdx/search/cdx'
  private readonly waybackUrl = 'https://web.archive.org/web'

  /**
   * Get all available snapshots for a URL
   * @param url - The RSS feed URL to search for
   * @param limit - Maximum snapshots to return (default 1000, max 5000)
   */
  async getSnapshots(url: string, limit: number = 1000): Promise<WaybackSnapshot[]> {
    try {
      console.log(`    Querying Wayback Machine for ${url}...`)

      // CDX API query
      const response = await axios.get(this.cdxApiUrl, {
        params: {
          url,
          output: 'json',
          limit,
          filter: 'statuscode:200', // Only successful captures
          collapse: 'timestamp:8', // One per day to avoid duplicates
        },
        timeout: 90000, // 90 seconds - archive.org can be slow
      })

      if (!response.data || response.data.length === 0) {
        console.log(`    No Wayback snapshots found`)
        return []
      }

      // Skip header row, convert to structured data
      const results: WaybackCDXResult[] = response.data.slice(1).map((row: string[]) => ({
        urlkey: row[0]!,
        timestamp: row[1]!,
        original: row[2]!,
        mimetype: row[3]!,
        statuscode: row[4]!,
        digest: row[5]!,
        length: row[6]!,
      }))

      const snapshots = results.map((r) => ({
        timestamp: r.timestamp,
        url: `${this.waybackUrl}/${r.timestamp}/${r.original}`,
        status: r.statuscode,
      }))

      console.log(`    Found ${snapshots.length} historical snapshots`)
      return snapshots
    } catch (error) {
      console.error(`    Wayback query failed: ${error}`)
      return []
    }
  }

  /**
   * Fetch content from a specific Wayback snapshot
   */
  async fetchSnapshot(snapshotUrl: string): Promise<string | null> {
    try {
      const response = await axios.get(snapshotUrl, {
        timeout: 60000, // 60 seconds - fetching full RSS feed snapshots can be slow
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      return response.data
    } catch (error) {
      return null
    }
  }

  /**
   * Get snapshots from a specific time range
   * @param url - The URL to search
   * @param fromDate - Start date (YYYYMMDD format)
   * @param toDate - End date (YYYYMMDD format)
   */
  async getSnapshotsInRange(
    url: string,
    fromDate: string,
    toDate: string
  ): Promise<WaybackSnapshot[]> {
    try {
      const response = await axios.get(this.cdxApiUrl, {
        params: {
          url,
          output: 'json',
          from: fromDate,
          to: toDate,
          filter: 'statuscode:200',
          collapse: 'timestamp:8', // One per day
        },
        timeout: 90000, // 90 seconds - archive.org can be slow
      })

      if (!response.data || response.data.length === 0) {
        return []
      }

      const results: WaybackCDXResult[] = response.data.slice(1).map((row: string[]) => ({
        urlkey: row[0]!,
        timestamp: row[1]!,
        original: row[2]!,
        mimetype: row[3]!,
        statuscode: row[4]!,
        digest: row[5]!,
        length: row[6]!,
      }))

      return results.map((r) => ({
        timestamp: r.timestamp,
        url: `${this.waybackUrl}/${r.timestamp}/${r.original}`,
        status: r.statuscode,
      }))
    } catch (error) {
      console.error(`Wayback range query failed: ${error}`)
      return []
    }
  }

  /**
   * Get yearly snapshots for the past N years (one per year)
   * Good for sampling 10 years of history without overwhelming the system
   */
  async getYearlySnapshots(url: string, yearsBack: number = 10): Promise<WaybackSnapshot[]> {
    const now = new Date()
    const snapshots: WaybackSnapshot[] = []

    for (let i = 0; i < yearsBack; i++) {
      const year = now.getFullYear() - i
      const fromDate = `${year}0101`
      const toDate = `${year}1231`

      const yearSnapshots = await this.getSnapshotsInRange(url, fromDate, toDate)
      if (yearSnapshots.length > 0) {
        // Take middle snapshot of the year for best representation
        const midIndex = Math.floor(yearSnapshots.length / 2)
        snapshots.push(yearSnapshots[midIndex]!)
      }
    }

    return snapshots
  }
}
