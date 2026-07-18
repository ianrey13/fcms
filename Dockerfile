FROM php:8.3-fpm-alpine

# Install nginx
RUN apk add --no-cache nginx

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

# Remove excel config before composer install
RUN rm -f config/excel.php

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Install and build frontend
RUN npm install --legacy-peer-deps
RUN npm run build

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 755 /var/www/html/storage /var/www/html/bootstrap/cache

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8000

CMD ["/start.sh"]