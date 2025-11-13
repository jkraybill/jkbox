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
 * Recommended weird news subreddits
 */
export const WEIRD_NEWS_SUBREDDITS = [
  'nottheonion', // Satirical-sounding real news
  'offbeat', // Offbeat news stories
  'NewsOfTheWeird', // Weird news
  'NewsOfTheStupid', // Stupid news
  'FloridaMan', // Florida-specific weird news
  'brandnewsentence', // Never-before-said phrases
  'WTF_Florida', // More Florida weirdness
  'ANormalDayInRussia', // Russian oddities
  'PublicFreakout', // Public incidents
  'CrazyIdeas', // Unusual concepts
  'ABoringDystopia', // Dystopian reality
  'LateStageCapitalism', // Economic absurdity
  'SubredditDrama', // Internet drama
  'bestof', // Best Reddit content
  'facepalm', // Face-palm moments
  'Whatcouldgowrong', // Failed attempts
  'instant_regret', // Immediate consequences
  'JusticeServed', // Karma stories
  'MaliciousCompliance', // Following rules too literally
  'ProRevenge', // Revenge stories
]

/**
 * Fetches top posts from Reddit subreddits
 */
export class RedditFetcher {
  private readonly baseUrl = 'https://www.reddit.com'
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  private readonly rateLimitDelay = 2000 // 2 seconds between requests

  /**
   * Get top posts of all time from a subreddit
   * @param subreddit - Subreddit name (without r/)
   * @param limit - Maximum posts to fetch (default 1000, Reddit max)
   */
  async getTopPosts(subreddit: string, limit: number = 1000): Promise<RedditPost[]> {
    const posts: RedditPost[] = []
    let after: string | null = null
    const batchSize = 100 // Reddit API returns max 100 per request

    console.log(`    Fetching top posts from r/${subreddit}...`)

    try {
      while (posts.length < limit) {
        // Build URL with pagination
        const url = `${this.baseUrl}/r/${subreddit}/top.json`
        const params = {
          sort: 'top',
          t: 'all', // All time
          limit: Math.min(batchSize, limit - posts.length),
          ...(after ? { after } : {}),
        }

        // Fetch page
        const response = await axios.get<RedditApiResponse>(url, {
          params,
          headers: {
            'User-Agent': this.userAgent,
          },
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

        console.log(`    Progress: ${posts.length}/${limit} posts`)

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
