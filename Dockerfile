FROM richarvey/nginx-php-fpm:3.1.6-php83

WORKDIR /var/www/html

# Copy all files
COPY . .

# Set Composer to allow superuser
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader

# Build frontend assets (React + Vite)
RUN npm install --legacy-peer-deps
RUN npm run build

# Set permissions
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
RUN chmod -R 755 /var/www/html/storage /var/www/html/bootstrap/cache

# Laravel config
ENV APP_ENV=production
ENV APP_DEBUG=false
ENV LOG_CHANNEL=stderr

# Define the start command
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]