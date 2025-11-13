import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RSSScraperService } from './rss-scraper'
import nock from 'nock'

describe('RSSScraperService', () => {
  beforeEach(() => {
    nock.cleanAll()
  })

  describe('parseFeed', () => {
    it('should parse a valid RSS feed', async () => {
      const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Weird News Feed</title>
    <description>Strange stories from around the world</description>
    <link>https://example.com</link>
    <lastBuildDate>Wed, 13 Nov 2025 12:00:00 GMT</lastBuildDate>
    <item>
      <title>Man arrested for paying with marijuana</title>
      <description>A Florida man tried to pay for his meal with marijuana</description>
      <link>https://example.com/article1</link>
      <pubDate>Wed, 13 Nov 2025 10:00:00 GMT</pubDate>
      <author>John Doe</author>
    </item>
    <item>
      <title>Emu rides city bus</title>
      <description>Escaped emu spotted riding public transit</description>
      <link>https://example.com/article2</link>
      <pubDate>Tue, 12 Nov 2025 15:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

      nock('https://example.com')
        .get('/feed.xml')
        .reply(200, feedXml, { 'Content-Type': 'application/xml' })

      const scraper = new RSSScraperService()
      const result = await scraper.parseFeed('https://example.com/feed.xml')

      expect(result.title).toBe('Weird News Feed')
      expect(result.description).toBe('Strange stories from around the world')
      expect(result.link).toBe('https://example.com')
      expect(result.items).toHaveLength(2)
      expect(result.items[0]?.title).toBe('Man arrested for paying with marijuana')
      expect(result.items[1]?.title).toBe('Emu rides city bus')
    })

    it('should handle feed without lastBuildDate', async () => {
      const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
  </channel>
</rss>`

      nock('https://example.com')
        .get('/feed.xml')
        .reply(200, feedXml)

      const scraper = new RSSScraperService()
      const result = await scraper.parseFeed('https://example.com/feed.xml')

      expect(result.lastBuildDate).toBeUndefined()
    })

    it('should throw on malformed XML', async () => {
      nock('https://example.com')
        .get('/bad-feed.xml')
        .reply(200, 'not xml at all')

      const scraper = new RSSScraperService()

      await expect(
        scraper.parseFeed('https://example.com/bad-feed.xml')
      ).rejects.toThrow()
    })

    it('should throw on 404', async () => {
      nock('https://example.com')
        .get('/missing.xml')
        .reply(404)

      const scraper = new RSSScraperService()

      await expect(
        scraper.parseFeed('https://example.com/missing.xml')
      ).rejects.toThrow()
    })

    it('should handle Atom feeds', async () => {
      const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <link href="https://example.com"/>
  <entry>
    <title>Test Article</title>
    <link href="https://example.com/article"/>
    <summary>Article summary</summary>
    <published>2025-11-13T10:00:00Z</published>
  </entry>
</feed>`

      nock('https://example.com')
        .get('/atom.xml')
        .reply(200, atomXml)

      const scraper = new RSSScraperService()
      const result = await scraper.parseFeed('https://example.com/atom.xml')

      expect(result.title).toBe('Atom Feed')
      expect(result.items).toHaveLength(1)
    })
  })

  describe('discoverFeeds', () => {
    it('should find RSS feed links in HTML', async () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="alternate" type="application/rss+xml" title="Main Feed" href="/feed.xml">
  <link rel="alternate" type="application/rss+xml" title="Weird News" href="/weird/feed.xml">
  <link rel="stylesheet" href="/style.css">
</head>
<body>Content</body>
</html>`

      nock('https://example.com')
        .get('/')
        .reply(200, html, { 'Content-Type': 'text/html' })

      const scraper = new RSSScraperService()
      const feeds = await scraper.discoverFeeds('https://example.com')

      expect(feeds).toHaveLength(2)
      expect(feeds).toContainEqual({
        url: 'https://example.com/feed.xml',
        title: 'Main Feed',
      })
      expect(feeds).toContainEqual({
        url: 'https://example.com/weird/feed.xml',
        title: 'Weird News',
      })
    })

    it('should find Atom feed links', async () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="alternate" type="application/atom+xml" href="/atom.xml">
</head>
</html>`

      nock('https://example.com')
        .get('/')
        .reply(200, html)

      const scraper = new RSSScraperService()
      const feeds = await scraper.discoverFeeds('https://example.com')

      expect(feeds).toHaveLength(1)
      expect(feeds[0]?.url).toBe('https://example.com/atom.xml')
    })

    it('should handle relative URLs correctly', async () => {
      const html = `<html><head>
<link rel="alternate" type="application/rss+xml" href="/feed.xml">
<link rel="alternate" type="application/rss+xml" href="weird.xml">
<link rel="alternate" type="application/rss+xml" href="https://cdn.example.com/external.xml">
</head></html>`

      nock('https://example.com')
        .get('/news')
        .reply(200, html)

      const scraper = new RSSScraperService()
      const feeds = await scraper.discoverFeeds('https://example.com/news')

      expect(feeds).toHaveLength(3)
      expect(feeds[0]?.url).toBe('https://example.com/feed.xml')
      expect(feeds[1]?.url).toBe('https://example.com/weird.xml')
      expect(feeds[2]?.url).toBe('https://cdn.example.com/external.xml')
    })

    it('should return empty array when no feeds found', async () => {
      const html = '<html><head></head><body>No feeds here</body></html>'

      nock('https://example.com')
        .get('/')
        .reply(200, html)

      const scraper = new RSSScraperService()
      const feeds = await scraper.discoverFeeds('https://example.com')

      expect(feeds).toEqual([])
    })

    it('should handle connection errors', async () => {
      nock('https://example.com')
        .get('/')
        .replyWithError('Connection failed')

      const scraper = new RSSScraperService()

      await expect(
        scraper.discoverFeeds('https://example.com')
      ).rejects.toThrow()
    })
  })

  describe('isRecentlyUpdated', () => {
    it('should return true for feed updated within 30 days', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 10) // 10 days ago

      const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Recent Feed</title>
    <item>
      <title>Recent Article</title>
      <pubDate>${recentDate.toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`

      nock('https://example.com')
        .get('/feed.xml')
        .reply(200, feedXml)

      const scraper = new RSSScraperService()
      const isRecent = await scraper.isRecentlyUpdated('https://example.com/feed.xml')

      expect(isRecent).toBe(true)
    })

    it('should return false for feed with no recent articles', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 60) // 60 days ago

      const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Old Feed</title>
    <item>
      <title>Old Article</title>
      <pubDate>${oldDate.toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`

      nock('https://example.com')
        .get('/feed.xml')
        .reply(200, feedXml)

      const scraper = new RSSScraperService()
      const isRecent = await scraper.isRecentlyUpdated('https://example.com/feed.xml')

      expect(isRecent).toBe(false)
    })

    it('should return false for empty feed', async () => {
      const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`

      nock('https://example.com')
        .get('/feed.xml')
        .reply(200, feedXml)

      const scraper = new RSSScraperService()
      const isRecent = await scraper.isRecentlyUpdated('https://example.com/feed.xml')

      expect(isRecent).toBe(false)
    })
  })
})
