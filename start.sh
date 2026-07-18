#!/bin/bash

# Set permissions
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# Skip migrations - tables already exist
echo "✅ Skipping migrations - database already set up"

# Clear all caches
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear

# Cache for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Start PHP-FPM
php-fpm -D

# Start Nginx
nginx -g "daemon off;"