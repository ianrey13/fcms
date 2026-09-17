FROM php:8.3-fpm-alpine

# Install nginx, supervisor, and dependencies
RUN apk add --no-cache nginx bash curl supervisor gettext

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql bcmath pcntl

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

WORKDIR /var/www/html

COPY . .

ENV COMPOSER_ALLOW_SUPERUSER=1

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Install and build frontend
RUN npm install --legacy-peer-deps
RUN npm install react-is@18.2.0 --legacy-peer-deps
RUN npm run build

# Create storage directories
RUN mkdir -p storage/framework/views storage/framework/cache storage/framework/sessions
RUN mkdir -p storage/logs storage/app/public
RUN touch storage/logs/laravel.log

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 777 /var/www/html/public

# nginx template (with $PORT placeholder, substituted at runtime)
COPY nginx.conf.template /etc/nginx/http.d/default.conf.template

# Supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]