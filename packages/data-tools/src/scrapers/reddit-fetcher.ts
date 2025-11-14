/**
 * Reddit integration for weird news collection
 * Fetches top posts of all time from relevant subreddits
 */

import axios from 'axios'

export interface RedditPost {
  id: string
  title: string
  text: string
  url: string
  score: number
  createdAt: Date
  permalink: string
  subreddit: string
}

interface RedditApiResponse {
  data: {
    children: Array<{
      data: {
        id: string
        title: string
        selftext: string
        url: string
        score: number
        created_utc: number
        permalink: string
        subreddit: string
      }
    }>
    after: string | null
  }
}

/**
 * Recommended weird news subreddits (actual news only, not user-generated stories)
 */
export const WEIRD_NEWS_SUBREDDITS = [
  'nottheonion', // Satirical-sounding real news
  'offbeat', // Offbeat news stories
  'NewsOfTheWeird', // Weird news
  'NewsOfTheStupid', // Stupid news
  'FloridaMan', // Florida-specific weird news
]

/**
 * Fetches top posts from Reddit subreddits
 */
export class RedditFetcher {
  private readonly baseUrl = 'https://www.reddit.com'
  private readonly oauthBaseUrl = 'https://oauth.reddit.com'
  private readonly userAgent = 'jkbox-data-collector/0.1.0 (by /u/YOUR_USERNAME)'
  private readonly rateLimitDelay = 2000 // 2 seconds between requests
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  private readonly clientId: string | null
  private readonly clientSecret: string | null
  private readonly refreshToken: string | null
  private readonly username: string | null
  private readonly password: string | null

  constructor(
    clientId?: string,
    clientSecret?: string,
    refreshToken?: string,
    username?: string,
    password?: string
  ) {
    this.clientId = clientId || process.env.REDDIT_CLIENT_ID || null
    this.clientSecret = clientSecret || process.env.REDDIT_CLIENT_SECRET || null
    this.refreshToken = refreshToken || process.env.REDDIT_REFRESH_TOKEN || null
    this.username = username || process.env.REDDIT_USERNAME || null
    this.password = password || process.env.REDDIT_PASSWORD || null
  }

  /**
   * Get OAuth access token using refresh token (preferred) or password grant (legacy)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Reddit OAuth credentials not configured (missing client_id/client_secret).')
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    try {
      // Prefer refresh token flow (more secure)
      if (this.refreshToken) {
        const response = await axios.post(
          'https://www.reddit.com/api/v1/access_token',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken,
          }),
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'User-Agent': this.userAgent,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )

        this.accessToken = response.data.access_token
        this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000 // Refresh 1 min early

        return this.accessToken
      }

      // Fallback to password grant (less secure, legacy)
      if (this.username && this.password) {
        console.warn('⚠️  Using password grant - consider running `npm run reddit-auth` for secure OAuth')

        const response = await axios.post(
          'https://www.reddit.com/api/v1/access_token',
          new URLSearchParams({
            grant_type: 'password',
            username: this.username,
            password: this.password,
          }),
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'User-Agent': this.userAgent,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )

        this.accessToken = response.data.access_token
        this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000

        return this.accessToken
      }

      throw new Error('No Reddit authentication method configured (need refresh_token or username/password).')
    } catch (error) {
      throw new Error(`Failed to get Reddit OAuth token: ${error}`)
    }
  }

  /**
   * Check if OAuth is configured (refresh token preferred, password grant fallback)
   */
  private isOAuthConfigured(): boolean {
    const hasClientCredentials = !!(this.clientId && this.clientSecret)
    const hasRefreshToken = !!this.refreshToken
    const hasPasswordGrant = !!(this.username && this.password)

    return hasClientCredentials && (hasRefreshToken || hasPasswordGrant)
  }

  /**
   * Get top posts of all time from a subreddit
   * @param subreddit - Subreddit name (without r/)
   * @param limit - Maximum posts to fetch (default 1000, Reddit max)
   */
  async getTopPosts(subreddit: string, limit: number = 1000): Promise<RedditPost[]> {
    const posts: RedditPost[] = []
    let after: string | null = null
    const batchSize = 100 // Reddit API returns max 100 per request

    // Check if OAuth is configured
    const useOAuth = this.isOAuthConfigured()
    const maxPosts = useOAuth ? limit : Math.min(limit, 250) // Unauthenticated API limited to 250

    if (!useOAuth && limit > 250) {
      console.log(`    ⚠️  OAuth not configured - limited to 250 posts (requested ${limit})`)
    }

    console.log(`    Fetching top posts from r/${subreddit}... (${useOAuth ? 'authenticated' : 'unauthenticated'})`)

    try {
      // Get OAuth token if configured
      let accessToken: string | null = null
      if (useOAuth) {
        try {
          accessToken = await this.getAccessToken()
          console.log(`    ✓ OAuth authenticated`)
        } catch (error) {
          console.error(`    ⚠️  OAuth failed, falling back to unauthenticated: ${error}`)
        }
      }

      while (posts.length < maxPosts) {
        // Build URL with pagination - use OAuth endpoint if authenticated
        const baseUrl = accessToken ? this.oauthBaseUrl : this.baseUrl
        const url = accessToken
          ? `${baseUrl}/r/${subreddit}/top`
          : `${baseUrl}/r/${subreddit}/top.json`

        const params = {
          sort: 'top',
          t: 'all', // All time
          limit: Math.min(batchSize, maxPosts - posts.length),
          ...(after ? { after } : {}),
        }

        // Build headers
        const headers: Record<string, string> = {
          'User-Agent': this.userAgent,
        }
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        // Fetch page
        const response = await axios.get<RedditApiResponse>(url, {
          params,
          headers,
          timeout: 15000,
        })

        if (!response.data?.data?.children || response.data.data.children.length === 0) {
          console.log(`    No more posts available (got ${posts.length} total)`)
          break
        }

        // Parse posts
        for (const child of response.data.data.children) {
          const post = child.data
          posts.push({
            id: post.id,
            title: post.title,
            text: post.selftext || '',
            url: post.url,
            score: post.score,
            createdAt: new Date(post.created_utc * 1000),
            permalink: `${this.baseUrl}${post.permalink}`,
            subreddit: post.subreddit,
          })
        }

        console.log(`    Progress: ${posts.length}/${maxPosts} posts`)

        // Check if there are more pages
        after = response.data.data.after
        if (!after) {
          console.log(`    Reached end of results (got ${posts.length} total)`)
          break
        }

        // Rate limiting
        await this.delay(this.rateLimitDelay)
      }

      console.log(`    ✓ Fetched ${posts.length} top posts from r/${subreddit}`)
      return posts
    } catch (error) {
      console.error(`    ✗ Failed to fetch r/${subreddit}: ${error}`)
      return posts // Return what we got so far
    }
  }

  /**
   * Get top posts from multiple subreddits
   * @param subreddits - Array of subreddit names
   * @param postsPerSubreddit - Posts to fetch per subreddit
   */
  async getTopPostsFromMultiple(
    subreddits: string[],
    postsPerSubreddit: number = 1000
  ): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = []

    console.log(`  Fetching top posts from ${subreddits.length} subreddits...`)

    for (let i = 0; i < subreddits.length; i++) {
      const subreddit = subreddits[i]!
      console.log(`  [${i + 1}/${subreddits.length}] r/${subreddit}`)

      const posts = await this.getTopPosts(subreddit, postsPerSubreddit)
      allPosts.push(...posts)

      // Rate limiting between subreddits
      if (i < subreddits.length - 1) {
        await this.delay(this.rateLimitDelay)
      }
    }

    console.log(`  ✓ Total posts collected: ${allPosts.length}`)
    return allPosts
  }

  /**
   * Get posts with minimum score threshold
   * Useful for filtering out low-quality content
   */
  filterByScore(posts: RedditPost[], minScore: number): RedditPost[] {
    return posts.filter((p) => p.score >= minScore)
  }

  /**
   * Get posts from specific time range
   */
  filterByDateRange(posts: RedditPost[], startDate: Date, endDate: Date): RedditPost[] {
    return posts.filter((p) => p.createdAt >= startDate && p.createdAt <= endDate)
  }

  /**
   * Sort posts by score (highest first)
   */
  sortByScore(posts: RedditPost[]): RedditPost[] {
    return [...posts].sort((a, b) => b.score - a.score)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
