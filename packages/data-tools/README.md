# @jkbox/data-tools

Ethical internet harvesting tools for game content generation.

## Overview

This package provides utilities for discovering and cataloguing content from legitimate news sources worldwide. Designed to support the Fake Facts game and future game modules.

**Phase 1 Foundation (v0.1.0):** ✅ Complete
- PostgreSQL schema for feeds, articles, domain discovery
- Rate limiter with per-domain throttling
- Retry handler with exponential backoff
- Robots.txt compliance checker
- Local LLM integration (Ollama) for content classification
- 14-language support (EN, ZH, FR, ES, IT, PT, JA, RU, NL, PL, TR, FA, VI, AR)

## Features

- **Ethical Scraping**: Respects robots.txt, rate limits, terms of service
- **Local Storage**: PostgreSQL + JSON exports, no cloud dependencies
- **Multi-language**: 14 languages from day 1
- **Content Classification**: Ollama LLM for "weird news" detection
- **Domain Tracking**: Tracks ALL evaluated domains for future game reuse
- **TDD Approach**: Comprehensive test coverage

## Installation

```bash
npm install
```

## Configuration

### Database Setup

Create a PostgreSQL database and run the schema:

```bash
psql -d your_database < src/storage/db/schema.sql
```

Set environment variables:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/jkbox_data"
```

### Ollama Setup

Ensure Ollama is running locally:

```bash
ollama pull llama3.2:latest
ollama serve
```

## Usage

### CLI Commands

```bash
# Discover RSS feeds from seed domains
npm run discover-feeds -- --seed seeds/weird-news-feeds.json

# Fetch articles from catalogued feeds
npm run fetch-articles

# List feeds by category/language
npm run list-feeds -- --category weird --language en

# Validate a specific feed
npm run validate-feed -- --url https://example.com/feed.rss

# Check health of all feeds
npm run check-health
```

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Lint
npm run lint
```

## Architecture

See `docs/DATA_COLLECTION_SPEC.md` (issue #5) for full specification.

### Key Components

- **Scrapers**: Base scraper + RSS scraper (HTML scraper future)
- **Storage**: PostgreSQL queries + JSON file exports
- **LLM**: Ollama abstraction layer for content classification
- **Utils**: Rate limiter, retry handler, robots checker, user-agent

### Data Model

- **FeedSource**: RSS feed metadata + quality metrics
- **Article**: Full article text + weird/not-weird classification
- **DomainDiscovery**: Tracks ALL evaluated domains (for future games)
- **DiscoverySession**: Discovery run metrics

## Ethical Guidelines

1. **Robots.txt**: Always checked before scraping
2. **Rate Limiting**: 1 req/sec per domain (configurable)
3. **User-Agent**: Clearly identifies jkbox data collector
4. **Attribution**: Source URLs stored for all content
5. **Fair Use**: Content transformed for game generation

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- rate-limiter

# Coverage report
npm run test:coverage
```

Test coverage target: >80%

## License

UNLICENSED - Private project

## Roadmap

- **Phase 2**: RSS discovery implementation
- **Phase 3**: Storage & CLI commands
- **Phase 4**: Monitoring & quality metrics
- **Phase 5+**: Article fetching, HTML scraping, game integration
