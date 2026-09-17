#!/bin/sh
set -e

echo "🚀 Starting FCMS container..."

# Substitute $PORT into nginx config
echo "📝 Generating nginx config (listening on port ${PORT})..."
envsubst '${PORT}' < /etc/nginx/http.d/default.conf.template > /etc/nginx/http.d/default.conf

# Verify it worked
echo "✅ nginx config:"
grep "listen" /etc/nginx/http.d/default.conf

# Laravel production caching
echo "🔧 Caching Laravel config..."
php artisan config:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run migrations (safe — uses IF NOT EXISTS logic via Laravel)
echo "🗄️  Running migrations..."
php artisan migrate --force || echo "⚠️ Migrations failed but continuing..."

# Fix storage permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true

# Start supervisor (which starts nginx + php-fpm)
echo "🎬 Starting supervisor..."
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf