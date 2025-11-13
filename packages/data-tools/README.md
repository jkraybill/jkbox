# @jkbox/data-tools

Ethical internet harvesting tools for game content generation.

## Overview

This package provides utilities for discovering and cataloguing content from legitimate news sources worldwide. Designed to support the Fake Facts game and future game modules.

**Phase 2 Complete (v0.2.0):** ✅ Working discovery pipeline!
- RSS feed discovery and parsing
- Multi-language category detection
- Ollama LLM content classification
- PostgreSQL storage
- CLI commands for discovery and querying

## Quick Start

### 1. Setup Database

Create PostgreSQL database:

```bash
createdb jkbox_data
psql jkbox_data < src/storage/db/schema.sql
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/jkbox_data"
```

### 3. Ensure Ollama is Running

```bash
ollama pull llama3.2:latest
ollama serve
```

### 4. Discover Feeds

```bash
# Discover Arabic feeds (5 domains)
npm run discover-feeds -- --language ar --limit 5

# Discover all English feeds
npm run discover-feeds -- --language en

# List discovered feeds
npm run list-feeds -- --language ar --limit 10
```

## Usage Examples

### Discover feeds from specific language

```bash
npm run discover-feeds -- --language ar --limit 5
```

This will:
1. Load seed domains for Arabic language
2. Discover RSS feeds on each domain
3. Sample 5 articles from each feed
4. Classify articles using Ollama (weird vs normal)
5. Save validated feeds to PostgreSQL
6. Show results with example headlines

### Query discovered feeds

```bash
# List Arabic feeds
npm run list-feeds -- --language ar

# List top 5 French feeds
npm run list-feeds -- --language fr --limit 5
```

### Advanced discovery options

```bash
# Sample 10 articles per feed (default: 5)
npm run discover-feeds -- --language es --sample-size 10

# Require at least 3 weird articles to validate feed (default: 1)
npm run discover-feeds -- --language en --weird-threshold 3
```

## Architecture

### Discovery Pipeline (5 Steps)

1. **Domain Authority** - Check if domain is legitimate (future: Tranco/Alexa)
2. **Technical Validation** - Check SSL, robots.txt, domain age
3. **Feed Discovery** - Find RSS/Atom links on homepage
4. **Category Detection** - Keyword matching + URL patterns
5. **Content Classification** - Ollama LLM samples articles for "weird" content

### Key Components

- **RSSScraperService**: Discover and parse RSS/Atom feeds
- **CategoryDetector**: Multi-language keyword detection
- **LocalLLM**: Ollama abstraction for content classification
- **DiscoveryService**: Main orchestrator (coordinates all steps)
- **DatabaseQueries**: Type-safe PostgreSQL queries
- **CLI Commands**: User-friendly discovery and query tools

### Data Flow

```
Seed Domains → Feed Discovery → Parse Feeds → Sample Articles
                                                     ↓
Database ← Validated Feeds ← Ollama Classification ←
```

## Development

```bash
# Run tests
npm test

# Run specific test
npm test -- rss-scraper

# Test coverage
npm run test:coverage

# Build
npm run build

# Lint
npm run lint
```

## Testing

47 tests covering:
- Rate limiter (7 tests)
- Retry handler (8 tests)
- RSS scraper (13 tests)
- Category detector (19 tests)

All TDD approach with mocked HTTP and Ollama responses.

## Configuration

### config/llm.json

```json
{
  "provider": "ollama",
  "model": "llama3.2:latest",
  "endpoint": "http://localhost:11434",
  "temperature": 0.3,
  "maxTokens": 200
}
```

### config/scraping.json

```json
{
  "userAgent": "jkbox-data-collector/0.1.0 (+https://github.com/jkraybill/jkbox; data@jkbox.party)",
  "defaultRateLimit": 1000,
  "maxConcurrentDomains": 5,
  "requestTimeout": 10000,
  "maxRetries": 3
}
```

### seeds/weird-news-feeds.json

18 major newspapers across 14 languages with curated keywords per language.

## Supported Languages

EN, ZH, FR, ES, IT, PT, JA, RU, NL, PL, TR, FA, VI, AR

Each language has keywords for "weird/offbeat" news:
- English: weird, offbeat, oddly, strange, unusual, bizarre
- Spanish: extraño, raro, insólito, curioso
- French: étrange, insolite, bizarre, incroyable
- Arabic: غريب, عجيب, نادر
- ...and more

## Collection Approach

1. **Rate Limiting**: 2 req/sec per domain with ±20% random jitter
2. **Human-like Behavior**: Rotating browser user-agents, random delays
3. **Respectful Access**: Conservative rate limits to avoid server load
4. **Attribution**: Source URLs stored for all content
5. **Fair Use**: Content transformed for game generation (entertainment)

## Troubleshooting

### "DATABASE_URL environment variable not set"

Set your PostgreSQL connection string:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/jkbox_data"
```

### "Ollama classification failed"

Ensure Ollama is running:

```bash
ollama serve
ollama list  # Verify llama3.2:latest is installed
```

### No feeds discovered

Check seed data has domains for your language:

```bash
cat seeds/weird-news-feeds.json | grep '"language": "ar"'
```

## Next Steps (Phase 3)

- Article fetching (download full articles)
- Enhanced validation (domain authority checking)
- Quality metrics and monitoring
- Feed health checking
- Export to game formats

## License

UNLICENSED - Private project
