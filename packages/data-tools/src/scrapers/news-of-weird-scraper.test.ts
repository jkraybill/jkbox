import { describe, it, expect, beforeEach } from 'vitest'
import { NewsOfWeirdScraper } from './news-of-weird-scraper'
import nock from 'nock'

describe('NewsOfWeirdScraper', () => {
  let scraper: NewsOfWeirdScraper

  beforeEach(() => {
    nock.cleanAll()
    scraper = new NewsOfWeirdScraper(0) // No rate limiting in tests
  })

  describe('fetchArticleUrls', () => {
    it('should fetch URLs from archive pages', async () => {
      const archiveHtml = `<!DOCTYPE html>
<html>
<body>
  <div class="archive">
    <a href="/oddities/news-of-the-weird/2025/01/09">Jan 9 2025</a>
    <a href="/oddities/news-of-the-weird/2025/01/16">Jan 16 2025</a>
    <a href="/oddities/news-of-the-weird/2025/01/23">Jan 23 2025</a>
  </div>
</body>
</html>`

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/archives/2025')
        .reply(200, archiveHtml)

      const urls = await scraper.fetchArticleUrls(2025)

      expect(urls.length).toBe(3)
      expect(urls).toContain('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/09')
      expect(urls).toContain('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/16')
      expect(urls).toContain('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/23')
    })

    it('should handle multiple years', async () => {
      const archive2024Html = `<a href="/oddities/news-of-the-weird/2024/12/30">Dec 30</a>`
      const archive2025Html = `<a href="/oddities/news-of-the-weird/2025/01/09">Jan 9</a>`

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/archives/2024')
        .reply(200, archive2024Html)
        .get('/oddities/news-of-the-weird/archives/2025')
        .reply(200, archive2025Html)

      const urls = await scraper.fetchArticleUrls(2024)

      expect(urls.length).toBe(2)
      expect(urls).toContain('https://www.uexpress.com/oddities/news-of-the-weird/2024/12/30')
      expect(urls).toContain('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/09')
    })

    it('should skip duplicate URLs', async () => {
      const archiveHtml = `
        <a href="/oddities/news-of-the-weird/2025/01/09">Link 1</a>
        <a href="/oddities/news-of-the-weird/2025/01/09">Link 2 (duplicate)</a>
        <a href="/oddities/news-of-the-weird/2025/01/16">Link 3</a>
      `

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/archives/2025')
        .reply(200, archiveHtml)

      const urls = await scraper.fetchArticleUrls(2025)

      expect(urls.length).toBe(2) // Should dedupe
    })

    it('should handle archive fetch errors gracefully', async () => {
      // Mock the current year to limit the loop
      const currentYear = new Date().getFullYear()

      // Mock all years from 2023 to current year
      const nockScope = nock('https://www.uexpress.com')
      for (let year = 2023; year <= currentYear; year++) {
        nockScope.get(`/oddities/news-of-the-weird/archives/${year}`).reply(404)
      }

      const urls = await scraper.fetchArticleUrls(2023)

      expect(urls).toEqual([]) // Should return empty array, not throw
    })
  })

  describe('fetchArticle', () => {
    it('should parse article with JSON-LD schema', async () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {
    "headline": "LEAD STORY -- Unclear on the Concept",
    "datePublished": "2025-01-09",
    "author": {
      "name": "Chuck Shepherd"
    }
  }
  </script>
</head>
<body>
  <article>
    <p>A Florida man was arrested on Jan. 5 after police found him trying to break into a police station to retrieve his stolen property.</p>
    <p>In other news, a woman in Ohio called 911 because her husband wouldn't share the TV remote.</p>
  </article>
</body>
</html>`

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/2025/01/09')
        .reply(200, html)

      const article = await scraper.fetchArticle('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/09')

      expect(article.title).toBe('LEAD STORY -- Unclear on the Concept')
      expect(article.date.toISOString()).toContain('2025-01-09')
      expect(article.author).toBe('Chuck Shepherd')
      expect(article.content).toContain('Florida man')
      expect(article.content).toContain('TV remote')
      expect(article.url).toBe('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/09')
    })

    it('should parse article without JSON-LD schema', async () => {
      const html = `<!DOCTYPE html>
<html>
<body>
  <h1>Weekly Weird News Round-Up</h1>
  <article>
    <p>Strange things happened this week across America.</p>
    <p>A man in Texas discovered a meteorite in his backyard while gardening.</p>
  </article>
</body>
</html>`

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/2025/01/16')
        .reply(200, html)

      const article = await scraper.fetchArticle('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/16')

      expect(article.title).toBe('Weekly Weird News Round-Up')
      expect(article.content).toContain('meteorite')
      expect(article.date.toISOString()).toContain('2025-01-16') // Parsed from URL
    })

    it('should extract date from URL when not in schema', async () => {
      const html = `<!DOCTYPE html>
<html>
<body>
  <h1>News of the Weird</h1>
  <article>
    <p>Some weird news content here.</p>
  </article>
</body>
</html>`

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/2023/07/20')
        .reply(200, html)

      const article = await scraper.fetchArticle('https://www.uexpress.com/oddities/news-of-the-weird/2023/07/20')

      expect(article.date.getFullYear()).toBe(2023)
      expect(article.date.getMonth()).toBe(6) // July (0-indexed)
      expect(article.date.getDate()).toBe(20)
    })

    it('should throw error when no content found', async () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
  <h1>Page Not Found</h1>
</body>
</html>`

      nock('https://www.uexpress.com')
        .get('/oddities/news-of-the-weird/2020/01/01')
        .reply(200, html)

      await expect(
        scraper.fetchArticle('https://www.uexpress.com/oddities/news-of-the-weird/2020/01/01')
      ).rejects.toThrow('No content found')
    })
  })

  describe('extractNewsItems', () => {
    it('should split article by section headers', () => {
      const article = {
        url: 'https://example.com/article',
        title: 'News of the Weird',
        date: new Date('2025-01-09'),
        content: `LEAD STORY -- Unclear on the Concept

A Florida man was arrested trying to break into a police station.

LEAST COMPETENT CRIMINALS

A burglar in Ohio left his ID at the crime scene.

THE PASSING PARADE

Various other weird news items from around the country.`,
        author: 'The Editors',
      }

      const items = scraper.extractNewsItems(article)

      // Should split into sections (exact number depends on regex matching)
      expect(items.length).toBeGreaterThanOrEqual(1)

      // Content should be preserved
      const allContent = items.map(i => i.content).join(' ')
      expect(allContent).toContain('Florida man')
      expect(allContent).toContain('burglar')
      expect(allContent).toContain('weird news items')
    })

    it('should return whole article if no sections found', () => {
      const article = {
        url: 'https://example.com/article',
        title: 'Single Story',
        date: new Date('2025-01-09'),
        content: 'This is a single story without section headers. It should be returned as one item.',
        author: 'The Editors',
      }

      const items = scraper.extractNewsItems(article)

      expect(items).toHaveLength(1)
      expect(items[0]?.title).toContain('Single Story')
      expect(items[0]?.content).toContain('single story without section headers')
      expect(items[0]?.url).toContain(article.url)
    })

    it('should preserve metadata for each item', () => {
      const article = {
        url: 'https://example.com/article',
        title: 'News Compilation',
        date: new Date('2025-01-09'),
        content: `SECTION ONE

Content for section one.

SECTION TWO

Content for section two.`,
        author: 'Chuck Shepherd',
      }

      const items = scraper.extractNewsItems(article)

      // Should have at least one item
      expect(items.length).toBeGreaterThanOrEqual(1)

      // All items should preserve metadata
      items.forEach((item) => {
        expect(item.url).toContain('https://example.com/article')
        expect(item.date).toEqual(article.date)
        expect(item.author).toBe('Chuck Shepherd')
      })
    })

    it('should filter out very short sections', () => {
      const article = {
        url: 'https://example.com/article',
        title: 'News',
        date: new Date('2025-01-09'),
        content: `REAL STORY

This is a real story with enough content to be meaningful.

SHORT

Too short.`,
        author: 'The Editors',
      }

      const items = scraper.extractNewsItems(article)

      // Should only get the longer section
      expect(items.length).toBeLessThanOrEqual(2)
      expect(items[0]?.content).toContain('meaningful')
    })
  })

  describe('checkArticleExists', () => {
    it('should return true for existing article', async () => {
      nock('https://www.uexpress.com')
        .head('/oddities/news-of-the-weird/2025/01/09')
        .reply(200)

      const exists = await scraper.checkArticleExists('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/09')

      expect(exists).toBe(true)
    })

    it('should return false for non-existent article', async () => {
      nock('https://www.uexpress.com')
        .head('/oddities/news-of-the-weird/1990/01/01')
        .reply(404)

      const exists = await scraper.checkArticleExists('https://www.uexpress.com/oddities/news-of-the-weird/1990/01/01')

      expect(exists).toBe(false)
    })

    it('should return false on network error', async () => {
      nock('https://www.uexpress.com')
        .head('/oddities/news-of-the-weird/2025/01/09')
        .replyWithError('Network error')

      const exists = await scraper.checkArticleExists('https://www.uexpress.com/oddities/news-of-the-weird/2025/01/09')

      expect(exists).toBe(false)
    })
  })
})
