#!/bin/bash
set -e  # Exit on error

# jkbox Data Export Script
# Exports .env files, PostgreSQL database, Gordo memory, and Redis for migration
# Creates: jkbox-migration-YYYYMMDD-HHMMSS.tar.gz

echo "=========================================="
echo "jkbox Data Migration - Export"
echo "=========================================="
echo ""

# Check for required tools
echo "Checking dependencies..."
for cmd in pg_dump tar; do
    if ! command -v $cmd &> /dev/null; then
        echo "ERROR: $cmd is not installed"
        exit 1
    fi
done

# Check for redis-cli (optional)
REDIS_AVAILABLE=false
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        REDIS_AVAILABLE=true
        echo "✓ Redis is running"
    else
        echo "⚠ Redis not running (will skip Redis export)"
    fi
else
    echo "⚠ redis-cli not found (will skip Redis export)"
fi

# Create temporary directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_DIR="/tmp/jkbox-export-${TIMESTAMP}"
TARBALL_NAME="jkbox-migration-${TIMESTAMP}.tar.gz"
mkdir -p "$EXPORT_DIR"

echo "Export directory: $EXPORT_DIR"
echo ""

# Step 1: Export .env files
echo "[1/4] Exporting .env files..."
if [ -f ".env" ]; then
    cp .env "$EXPORT_DIR/root.env"
    echo "  ✓ Copied .env"
else
    echo "  ⚠ No .env file found in root"
fi

if [ -f "packages/data-tools/.env" ]; then
    cp packages/data-tools/.env "$EXPORT_DIR/data-tools.env"
    echo "  ✓ Copied packages/data-tools/.env"
else
    echo "  ⚠ No .env file found in packages/data-tools/"
fi

# Step 2: Export PostgreSQL database
echo ""
echo "[2/4] Exporting PostgreSQL database..."
DB_NAME="jkbox_data"

# Check if database exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "  Dumping database: $DB_NAME"
    sudo -u postgres pg_dump "$DB_NAME" > "$EXPORT_DIR/jkbox_data.sql"
    DB_SIZE=$(du -h "$EXPORT_DIR/jkbox_data.sql" | cut -f1)
    echo "  ✓ Database exported (${DB_SIZE})"

    # Get record counts for verification
    echo "  Database contents:"
    sudo -u postgres psql "$DB_NAME" -t -c "SELECT COUNT(*) FROM articles" 2>/dev/null | xargs echo "    - Articles:" || echo "    - Articles: 0"
    sudo -u postgres psql "$DB_NAME" -t -c "SELECT COUNT(*) FROM fake_facts_questions" 2>/dev/null | xargs echo "    - Questions:" || echo "    - Questions: 0"
    sudo -u postgres psql "$DB_NAME" -t -c "SELECT COUNT(*) FROM feed_sources" 2>/dev/null | xargs echo "    - Feed sources:" || echo "    - Feed sources: 0"
else
    echo "  ⚠ Database '$DB_NAME' not found (creating empty marker)"
    touch "$EXPORT_DIR/no-database.marker"
fi

# Step 3: Export Gordo memory
echo ""
echo "[3/4] Exporting Gordo memory vector database..."
if [ -d ".gordo-memory" ]; then
    cp -r .gordo-memory "$EXPORT_DIR/"
    MEMORY_SIZE=$(du -sh .gordo-memory | cut -f1)
    echo "  ✓ Gordo memory exported (${MEMORY_SIZE})"

    # Count sessions if metadata exists
    if [ -f ".gordo-memory/metadata.json" ]; then
        SESSION_COUNT=$(grep -o '"id":' .gordo-memory/metadata.json | wc -l)
        echo "    - Sessions indexed: ${SESSION_COUNT}"
    fi
else
    echo "  ⚠ No .gordo-memory directory found"
    touch "$EXPORT_DIR/no-gordo-memory.marker"
fi

# Step 4: Export Redis
echo ""
echo "[4/4] Exporting Redis cache..."
if [ "$REDIS_AVAILABLE" = true ]; then
    echo "  Triggering Redis BGSAVE..."
    redis-cli BGSAVE > /dev/null

    # Wait for BGSAVE to complete (max 30 seconds)
    for i in {1..30}; do
        SAVE_STATUS=$(redis-cli LASTSAVE)
        sleep 1
        NEW_STATUS=$(redis-cli LASTSAVE)
        if [ "$NEW_STATUS" != "$SAVE_STATUS" ]; then
            break
        fi
    done

    # Find Redis dump file
    REDIS_DUMP="/var/lib/redis/dump.rdb"
    if [ ! -f "$REDIS_DUMP" ]; then
        # Try alternative location
        REDIS_DUMP="/var/lib/redis/6379/dump.rdb"
    fi

    if [ -f "$REDIS_DUMP" ]; then
        sudo cp "$REDIS_DUMP" "$EXPORT_DIR/dump.rdb"
        REDIS_SIZE=$(du -h "$EXPORT_DIR/dump.rdb" | cut -f1)
        KEY_COUNT=$(redis-cli DBSIZE)
        echo "  ✓ Redis exported (${REDIS_SIZE}, ${KEY_COUNT} keys)"
    else
        echo "  ⚠ Could not find Redis dump.rdb file"
        touch "$EXPORT_DIR/no-redis.marker"
    fi
else
    echo "  ⚠ Skipping Redis (not available)"
    touch "$EXPORT_DIR/no-redis.marker"
fi

# Create tarball
echo ""
echo "Creating tarball..."
cd /tmp
tar -czf "$TARBALL_NAME" "jkbox-export-${TIMESTAMP}/"
TARBALL_SIZE=$(du -h "$TARBALL_NAME" | cut -f1)

# Move tarball to current directory
mv "$TARBALL_NAME" "$OLDPWD/"
cd "$OLDPWD"

# Cleanup
rm -rf "$EXPORT_DIR"

# Summary
echo ""
echo "=========================================="
echo "Export Complete!"
echo "=========================================="
echo ""
echo "Tarball: $TARBALL_NAME"
echo "Size: $TARBALL_SIZE"
echo ""
echo "Contents:"
echo "  ✓ .env files (credentials & API keys)"
[ -f "/tmp/jkbox-export-${TIMESTAMP}/jkbox_data.sql" ] && echo "  ✓ PostgreSQL database (jkbox_data)"
[ -d "/tmp/jkbox-export-${TIMESTAMP}/.gordo-memory" ] && echo "  ✓ Gordo memory vector database"
[ -f "/tmp/jkbox-export-${TIMESTAMP}/dump.rdb" ] && echo "  ✓ Redis cache"
echo ""
echo "Next steps:"
echo "  1. Copy $TARBALL_NAME to your new laptop"
echo "  2. Run: ./scripts/import-data.sh $TARBALL_NAME"
echo ""
