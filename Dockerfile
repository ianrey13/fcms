FROM php:8.3-fpm-alpine

# Install nginx
RUN apk add --no-cache nginx bash

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql bcmath

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /var/www/html

# Copy files
COPY . .

# Set temporary environment variables
ENV BROADCAST_DRIVER=log
ENV REVERB_APP_KEY=temp
ENV REVERB_APP_SECRET=temp
ENV REVERB_APP_ID=temp
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Install frontend dependencies
RUN npm install --legacy-peer-deps
RUN npm install react-is@18.2.0 --legacy-peer-deps

# Build frontend
RUN npm run build

# Create storage directories
RUN mkdir -p storage/framework/views storage/framework/cache storage/framework/sessions
RUN mkdir -p storage/logs storage/app/public
RUN touch storage/logs/laravel.log

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8000

# Run everything directly
CMD sh -c "php artisan config:cache && php artisan route:cache && php artisan view:cache && php-fpm -D && nginx -g 'daemon off;'"