FROM php:8.3-fpm-alpine

# Install nginx and dependencies
RUN apk add --no-cache nginx bash curl

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql bcmath

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

WORKDIR /var/www/html

COPY . .

ENV BROADCAST_DRIVER=reverb
ENV REVERB_APP_KEY=temp
ENV REVERB_APP_SECRET=temp
ENV REVERB_APP_ID=temp
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# ✅ INSTALL REVERB
RUN composer require laravel/reverb

# ✅ Also install Reverb's dependencies if needed
RUN composer require laravel/prompts

# ✅ DEBUG: Check if Reverb is installed
RUN php artisan list | grep reverb || echo "⚠️ Reverb not found!"

# Install and build frontend
RUN npm install --legacy-peer-deps
RUN npm install react-is@18.2.0 --legacy-peer-deps
RUN npm run build

# Verify manifest was created
RUN ls -la /var/www/html/public/build/ || echo "Build failed!"

# Create storage directories
RUN mkdir -p storage/framework/views storage/framework/cache storage/framework/sessions
RUN mkdir -p storage/logs storage/app/public
RUN touch storage/logs/laravel.log

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 777 /var/www/html/public

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8000

# ✅ DEBUG: Run Reverb with logs visible
CMD sh -c "php artisan config:clear && php artisan route:clear && php artisan view:clear && php artisan cache:clear && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan schedule:work > /dev/null 2>&1 & php artisan queue:work --sleep=3 --tries=3 > /dev/null 2>&1 & php artisan reverb:start --host=0.0.0.0 --port=8000 2>&1 & php-fpm -D && nginx -g 'daemon off;'"