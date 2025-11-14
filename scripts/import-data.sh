#!/bin/bash
set -e  # Exit on error

# jkbox Data Import Script
# Imports data from tarball created by export-data.sh
# Usage: ./import-data.sh <tarball-name>

echo "=========================================="
echo "jkbox Data Migration - Import"
echo "=========================================="
echo ""

# Check for tarball argument
if [ $# -eq 0 ]; then
    echo "ERROR: No tarball specified"
    echo ""
    echo "Usage: ./scripts/import-data.sh jkbox-migration-YYYYMMDD-HHMMSS.tar.gz"
    echo ""
    exit 1
fi

TARBALL="$1"

# Check if tarball exists
if [ ! -f "$TARBALL" ]; then
    echo "ERROR: Tarball not found: $TARBALL"
    exit 1
fi

echo "Tarball: $TARBALL"
TARBALL_SIZE=$(du -h "$TARBALL" | cut -f1)
echo "Size: $TARBALL_SIZE"
echo ""

# Check for required tools
echo "Checking dependencies..."
for cmd in psql tar; do
    if ! command -v $cmd &> /dev/null; then
        echo "ERROR: $cmd is not installed"
        echo "Install PostgreSQL: sudo apt-get install postgresql postgresql-contrib"
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
        echo "⚠ Redis not running (will skip Redis import)"
    fi
else
    echo "⚠ redis-cli not found (will skip Redis import)"
fi

# Check if PostgreSQL is running
if ! sudo -u postgres psql -c '\q' &> /dev/null; then
    echo "ERROR: PostgreSQL is not running"
    echo "Start with: sudo systemctl start postgresql"
    exit 1
fi
echo "✓ PostgreSQL is running"
echo ""

# Extract tarball
echo "Extracting tarball..."
EXTRACT_DIR="/tmp/jkbox-import-$$"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR"

# Find the export directory inside
EXPORT_DIR=$(find "$EXTRACT_DIR" -type d -name "jkbox-export-*" | head -n 1)
if [ -z "$EXPORT_DIR" ]; then
    echo "ERROR: Could not find export directory in tarball"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

echo "✓ Extracted to: $EXPORT_DIR"
echo ""

# Step 1: Import .env files
echo "[1/4] Importing .env files..."

# Root .env
if [ -f "$EXPORT_DIR/root.env" ]; then
    if [ -f ".env" ]; then
        echo "  ⚠ Backing up existing .env to .env.backup"
        cp .env .env.backup
    fi
    cp "$EXPORT_DIR/root.env" .env
    chmod 600 .env
    echo "  ✓ Restored .env"
else
    echo "  ⚠ No root .env in tarball"
fi

# data-tools .env
if [ -f "$EXPORT_DIR/data-tools.env" ]; then
    mkdir -p packages/data-tools
    if [ -f "packages/data-tools/.env" ]; then
        echo "  ⚠ Backing up existing packages/data-tools/.env to .env.backup"
        cp packages/data-tools/.env packages/data-tools/.env.backup
    fi
    cp "$EXPORT_DIR/data-tools.env" packages/data-tools/.env
    chmod 600 packages/data-tools/.env
    echo "  ✓ Restored packages/data-tools/.env"
else
    echo "  ⚠ No data-tools .env in tarball"
fi

# Step 2: Import PostgreSQL database
echo ""
echo "[2/4] Importing PostgreSQL database..."
DB_NAME="jkbox_data"

if [ -f "$EXPORT_DIR/jkbox_data.sql" ]; then
    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo "  ⚠ Database '$DB_NAME' already exists"
        echo -n "  Drop and recreate? (y/N): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "  Dropping existing database..."
            sudo -u postgres dropdb "$DB_NAME"
        else
            echo "  Skipping database import"
            DB_NAME=""
        fi
    fi

    if [ -n "$DB_NAME" ]; then
        echo "  Creating database: $DB_NAME"
        sudo -u postgres createdb "$DB_NAME"

        echo "  Restoring from backup..."
        sudo -u postgres psql "$DB_NAME" < "$EXPORT_DIR/jkbox_data.sql" > /dev/null 2>&1

        echo "  ✓ Database restored"

        # Verify import
        echo "  Database contents:"
        sudo -u postgres psql "$DB_NAME" -t -c "SELECT COUNT(*) FROM articles" 2>/dev/null | xargs echo "    - Articles:" || echo "    - Articles: 0"
        sudo -u postgres psql "$DB_NAME" -t -c "SELECT COUNT(*) FROM fake_facts_questions" 2>/dev/null | xargs echo "    - Questions:" || echo "    - Questions: 0"
        sudo -u postgres psql "$DB_NAME" -t -c "SELECT COUNT(*) FROM feed_sources" 2>/dev/null | xargs echo "    - Feed sources:" || echo "    - Feed sources: 0"
    fi
elif [ -f "$EXPORT_DIR/no-database.marker" ]; then
    echo "  ℹ No database in export"
else
    echo "  ⚠ No database backup found in tarball"
fi

# Step 3: Import Gordo memory
echo ""
echo "[3/4] Importing Gordo memory vector database..."

if [ -d "$EXPORT_DIR/.gordo-memory" ]; then
    if [ -d ".gordo-memory" ]; then
        echo "  ⚠ Backing up existing .gordo-memory to .gordo-memory.backup"
        mv .gordo-memory .gordo-memory.backup
    fi

    cp -r "$EXPORT_DIR/.gordo-memory" .
    MEMORY_SIZE=$(du -sh .gordo-memory | cut -f1)
    echo "  ✓ Gordo memory restored (${MEMORY_SIZE})"

    if [ -f ".gordo-memory/metadata.json" ]; then
        SESSION_COUNT=$(grep -o '"id":' .gordo-memory/metadata.json | wc -l)
        echo "    - Sessions indexed: ${SESSION_COUNT}"
    fi
elif [ -f "$EXPORT_DIR/no-gordo-memory.marker" ]; then
    echo "  ℹ No Gordo memory in export"
else
    echo "  ⚠ No Gordo memory found in tarball"
fi

# Step 4: Import Redis
echo ""
echo "[4/4] Importing Redis cache..."

if [ -f "$EXPORT_DIR/dump.rdb" ]; then
    if [ "$REDIS_AVAILABLE" = true ]; then
        echo "  Stopping Redis..."
        sudo systemctl stop redis-server || sudo service redis-server stop

        # Find Redis data directory
        REDIS_DIR="/var/lib/redis"
        if [ ! -d "$REDIS_DIR" ]; then
            REDIS_DIR="/var/lib/redis/6379"
        fi

        if [ -d "$REDIS_DIR" ]; then
            if [ -f "$REDIS_DIR/dump.rdb" ]; then
                echo "  Backing up existing dump.rdb..."
                sudo mv "$REDIS_DIR/dump.rdb" "$REDIS_DIR/dump.rdb.backup"
            fi

            echo "  Copying Redis dump..."
            sudo cp "$EXPORT_DIR/dump.rdb" "$REDIS_DIR/dump.rdb"
            sudo chown redis:redis "$REDIS_DIR/dump.rdb" 2>/dev/null || sudo chown redis:redis "$REDIS_DIR/dump.rdb"
            sudo chmod 640 "$REDIS_DIR/dump.rdb"

            echo "  Starting Redis..."
            sudo systemctl start redis-server || sudo service redis-server start

            sleep 2
            KEY_COUNT=$(redis-cli DBSIZE 2>/dev/null || echo "?")
            echo "  ✓ Redis restored (${KEY_COUNT} keys)"
        else
            echo "  ⚠ Could not find Redis data directory"
        fi
    else
        echo "  ⚠ Skipping Redis (not available)"
    fi
elif [ -f "$EXPORT_DIR/no-redis.marker" ]; then
    echo "  ℹ No Redis cache in export"
else
    echo "  ⚠ No Redis dump found in tarball"
fi

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -rf "$EXTRACT_DIR"

# Summary
echo ""
echo "=========================================="
echo "Import Complete!"
echo "=========================================="
echo ""
echo "Imported:"
[ -f ".env" ] && echo "  ✓ .env files (credentials & API keys)"
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME" 2>/dev/null && echo "  ✓ PostgreSQL database (jkbox_data)"
[ -d ".gordo-memory" ] && echo "  ✓ Gordo memory vector database"
[ "$REDIS_AVAILABLE" = true ] && echo "  ✓ Redis cache"
echo ""
echo "Next steps:"
echo "  1. Install Ollama models:"
echo "     ollama pull llama3.2:latest"
echo "     ollama pull mxbai-embed-large:latest"
echo "     ollama pull nomic-embed-text:latest"
echo ""
echo "  2. Install dependencies:"
echo "     npm install"
echo ""
echo "  3. Test everything:"
echo "     npm test"
echo "     npm run dev:server"
echo "     npm run dev:client"
echo ""
