#!/bin/sh
set -e

echo "🚀 ============================================"
echo "🚀 FCMS Container Starting"
echo "🚀 ============================================"

# ============================================
# 1. Generate nginx config with Railway's $PORT
# ============================================
if [ -z "$PORT" ]; then
    echo "⚠️  PORT not set — defaulting to 8000"
    export PORT=8000
fi

echo "📝 Generating nginx config (listening on port ${PORT})..."
envsubst '${PORT}' < /etc/nginx/http.d/default.conf.template > /etc/nginx/http.d/default.conf
grep "listen" /etc/nginx/http.d/default.conf

# ============================================
# 2. Ensure writable storage
# ============================================
echo "🔧 Fixing storage permissions..."
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true

# ============================================
# 3. Laravel production caching
# ============================================
echo "🔧 Clearing stale caches..."
php artisan config:clear || true
php artisan route:clear || true
php artisan view:clear || true
php artisan cache:clear || true

echo "🔧 Building production caches..."
php artisan config:cache || echo "⚠️ config:cache failed"
php artisan route:cache || echo "⚠️ route:cache failed"
php artisan view:cache || echo "⚠️ view:cache failed"

# ============================================
# 4. Storage symlink (for public receipts)
# ============================================
echo "🔗 Creating storage symlink..."
php artisan storage:link || echo "⚠️ storage:link skipped"

# ============================================
# 5. Wait for MySQL, then migrate
# ============================================
echo "⏳ Waiting for MySQL..."
MAX_RETRIES=30
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
    if php artisan db:show > /dev/null 2>&1; then
        echo "✅ MySQL is ready"
        break
    fi
    RETRY=$((RETRY + 1))
    echo "  Waiting... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo "⚠️ MySQL not ready after $MAX_RETRIES retries — starting anyway"
else
    echo "🗄️  Running migrations..."
    php artisan migrate --force || echo "⚠️ Migrations failed — continuing"
fi

# ============================================
# 6. Start supervisor (nginx + php-fpm)
# ============================================
echo "🎬 Starting supervisor..."
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf