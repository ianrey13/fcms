FROM php:8.3-fpm-alpine

# Install nginx and dependencies
RUN apk add --no-cache nginx bash curl

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

# Build frontend - with verbose output
RUN npm run build --verbose

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

# Check if manifest exists
RUN ls -la /var/www/html/public/build/ || echo "Build directory not found"

EXPOSE 8000

# Clear all caches and start services
CMD sh -c "php artisan config:clear && php artisan route:clear && php artisan view:clear && php artisan cache:clear && php artisan config:cache && php artisan route:cache && php artisan view:cache && php-fpm -D && nginx -g 'daemon off;'"