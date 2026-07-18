#!/bin/bash

# Run migrations
php artisan migrate --force

# Clear and cache config
php artisan config:clear
php artisan route:clear
php artisan view:clear

php artisan config:cache
php artisan route:cache
php artisan view:cache

# Start PHP-FPM and Nginx
/usr/bin/supervisord -c /etc/supervisord.conf