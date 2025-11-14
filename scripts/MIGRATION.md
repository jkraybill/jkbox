# jkbox Data Migration Guide

Scripts to migrate your local jkbox data from one laptop to another.

## What Gets Migrated

✅ **Environment files** (.env with API keys & credentials)
✅ **PostgreSQL database** (articles, questions, feed sources)
✅ **Gordo memory** (vector database for session search)
✅ **Redis cache** (session data, game state)

❌ **NOT migrated:** Node modules (reinstall), Ollama models (re-pull), build artifacts

---

## Quick Start

### On Old Laptop

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Export all data
./scripts/export-data.sh

# This creates: jkbox-migration-YYYYMMDD-HHMMSS.tar.gz
```

### Transfer Tarball

Copy the generated `.tar.gz` file to your new laptop (USB drive, network transfer, etc.)

### On New Laptop

```bash
# Prerequisites: Install system dependencies first
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib redis-server

# Clone the repo
git clone https://github.com/jkraybill/jkbox.git
cd jkbox

# Make scripts executable
chmod +x scripts/*.sh

# Import data from tarball
./scripts/import-data.sh path/to/jkbox-migration-YYYYMMDD-HHMMSS.tar.gz

# Install Ollama models (~15 min, 3.96 GB)
ollama pull llama3.2:latest
ollama pull mxbai-embed-large:latest
ollama pull nomic-embed-text:latest

# Install Node dependencies
npm install

# Test everything
npm test
```

---

## Detailed Export Process

The `export-data.sh` script performs these steps:

1. **Checks dependencies** (pg_dump, redis-cli, tar)
2. **Exports .env files**
   - Root `.env` (GitHub, Anthropic keys)
   - `packages/data-tools/.env` (database, Reddit OAuth)
3. **Exports PostgreSQL database** (`jkbox_data`)
   - Uses `pg_dump` to create SQL backup
   - Includes all tables: articles, questions, answers, feeds
4. **Copies Gordo memory** (`.gordo-memory/`)
   - Vector index for session search
   - Session metadata
5. **Exports Redis cache** (if running)
   - Triggers `BGSAVE` to create dump.rdb
   - Copies to export bundle
6. **Creates tarball**
   - Compresses everything into timestamped archive
   - Typical size: 50 MB - 2 GB (depends on data)

**Output:** `jkbox-migration-YYYYMMDD-HHMMSS.tar.gz`

---

## Detailed Import Process

The `import-data.sh` script performs these steps:

1. **Checks dependencies** (PostgreSQL, optional Redis)
2. **Extracts tarball** to temporary directory
3. **Restores .env files**
   - Backs up existing files (`.env.backup`)
   - Copies restored files with secure permissions (600)
4. **Restores PostgreSQL database**
   - Prompts before dropping existing database
   - Creates `jkbox_data` database
   - Imports from SQL backup
   - Verifies record counts
5. **Restores Gordo memory**
   - Backs up existing directory if present
   - Copies vector database files
6. **Restores Redis cache** (if available)
   - Stops Redis service
   - Backs up existing dump.rdb
   - Restores backup and sets permissions
   - Restarts Redis service
7. **Cleans up** temporary files

---

## System Requirements

### Old Laptop (Export)
- PostgreSQL with `jkbox_data` database
- Optional: Redis running
- Disk space: ~500 MB free (for temporary export)

### New Laptop (Import)
- PostgreSQL 16+ installed and running
- Optional: Redis installed
- Disk space: ~5-7 GB (database + Ollama models)
- Ollama installed (for LLM models)

---

## Troubleshooting

### "ERROR: pg_dump is not installed"
```bash
sudo apt-get install postgresql-client
```

### "ERROR: PostgreSQL is not running"
```bash
sudo systemctl start postgresql
# or
sudo service postgresql start
```

### "Database already exists" on import
The import script will prompt you to drop and recreate. Choose:
- **Yes (y):** Replace with imported data
- **No (n):** Keep existing database (skip import)

### Redis import fails
Non-critical. Game will work without Redis cache (will just rebuild state).

To fix:
```bash
sudo systemctl status redis-server
sudo systemctl start redis-server
```

### Gordo memory missing after import
Non-critical. Will rebuild on next MCP query.

To force rebuild:
```bash
rm -rf .gordo-memory/
# Next mcp__gordo-memory__search will rebuild index
```

### Ollama models not working
Models aren't included in tarball (too large). Pull them manually:
```bash
ollama pull llama3.2:latest
ollama pull mxbai-embed-large:latest
ollama pull nomic-embed-text:latest
```

---

## What's NOT Migrated

**Node modules** - Reinstall with `npm install` (platform-specific binaries)

**Ollama models** - Re-pull manually (~15 min download)
- llama3.2:latest (1.92 GB)
- mxbai-embed-large:latest (639 MB)
- nomic-embed-text:latest (261 MB)

**Build artifacts** - Rebuild with `npm run build`

**Git history** - Already in remote repo (git clone handles this)

**Framework docs** - Checked into git (CONSTITUTION.md, JOURNAL.md, etc.)

---

## Verification Checklist

After import on new laptop:

```bash
# 1. Check .env files exist
ls -la .env packages/data-tools/.env

# 2. Verify database
sudo -u postgres psql jkbox_data -c "SELECT COUNT(*) FROM articles;"

# 3. Check Gordo memory
ls -la .gordo-memory/

# 4. Test Redis
redis-cli ping  # Should return: PONG

# 5. Verify Ollama models
ollama list  # Should show 3 models

# 6. Run tests
npm test  # Should see 175+ tests passing

# 7. Start dev servers
npm run dev:server  # Terminal 1
npm run dev:client  # Terminal 2
```

---

## Advanced: Selective Import

If you only need specific components:

**Just .env files:**
```bash
tar -xzf jkbox-migration-*.tar.gz --wildcards "*/root.env" "*data-tools.env"
cp jkbox-export-*/root.env .env
cp jkbox-export-*/data-tools.env packages/data-tools/.env
```

**Just PostgreSQL:**
```bash
tar -xzf jkbox-migration-*.tar.gz --wildcards "*/jkbox_data.sql"
sudo -u postgres createdb jkbox_data
sudo -u postgres psql jkbox_data < jkbox-export-*/jkbox_data.sql
```

**Just Gordo memory:**
```bash
tar -xzf jkbox-migration-*.tar.gz --wildcards "*/.gordo-memory/*"
cp -r jkbox-export-*/.gordo-memory .
```

---

## Security Notes

⚠️ **The tarball contains sensitive data:**
- API keys (Anthropic, GitHub, Reddit)
- Database credentials
- OAuth tokens

**Keep it secure:**
- Don't commit to git (`.tar.gz` in .gitignore)
- Don't upload to public cloud storage
- Delete after successful import
- Use encrypted transfer if over network

---

## File Sizes Reference

| Component | Typical Size | Notes |
|-----------|--------------|-------|
| .env files | <10 KB | Text configuration |
| PostgreSQL dump | 50 MB - 2 GB | Depends on articles collected |
| Gordo memory | ~300 KB | Vector index + metadata |
| Redis dump | 10-100 MB | Session cache |
| **Total tarball** | **50 MB - 2 GB** | Compressed |

---

## Support

If you encounter issues:

1. Check script output for specific errors
2. Verify prerequisites installed (PostgreSQL, Redis, Ollama)
3. Check service status: `sudo systemctl status postgresql`
4. Review logs in `/var/log/postgresql/` or `/var/log/redis/`

For script bugs, open an issue with:
- Export/import command used
- Error message
- OS version (`lsb_release -a`)
- PostgreSQL version (`psql --version`)

---

**Scripts created:** 2025-11-15
**jkbox version:** 0.1.0
**Tested on:** Ubuntu 22.04 LTS with PostgreSQL 16, Redis 7.x
