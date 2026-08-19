FROM php:8.3-fpm-alpine

# Install nginx, supervisor, and dependencies
RUN apk add --no-cache nginx bash curl supervisor

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql bcmath pcntl

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

WORKDIR /var/www/html

COPY . .

ENV COMPOSER_ALLOW_SUPERUSER=1

# ✅ Set BROADCAST_DRIVER to null to bypass broadcaster check during build
ENV BROADCAST_DRIVER=null
ENV BROADCAST_CONNECTION=null

# Install PHP dependencies (skip scripts)
RUN composer install --no-dev --optimize-autoloader --no-scripts

# ✅ Run scripts with BROADCAST_DRIVER=null
RUN composer run-script post-autoload-dump

# Install Reverb explicitly
RUN composer require laravel/reverb

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

# Copy nginx config to the correct location
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000 8080

# Start Supervisor (manages all processes)
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]