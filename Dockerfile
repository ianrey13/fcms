FROM php:8.4-fpm-alpine

# ============================================
# System packages + PHP extensions
# ============================================
RUN apk add --no-cache \
    nginx \
    bash \
    curl \
    supervisor \
    gettext \
    icu-dev \
    libzip-dev \
    oniguruma-dev \
    libpng-dev \
    nodejs \
    npm \
    && docker-php-ext-install \
        pdo \
        pdo_mysql \
        bcmath \
        pcntl \
        intl \
        zip \
        mbstring \
        gd

# ============================================
# Composer
# ============================================
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ============================================
# Copy app source
# ============================================
COPY . .

ENV COMPOSER_ALLOW_SUPERUSER=1

# ============================================
# BUILD-TIME ENV — safe defaults for Laravel boot during build
# Railway overrides these at runtime via its Variables tab
# ============================================
ENV APP_ENV=production
ENV APP_DEBUG=false
ENV APP_KEY=base64:k707We7Oouc2GJ0OIc5HAT9Jd8lIxLKB9QRXqCuVe90=
ENV BROADCAST_CONNECTION=log
ENV CACHE_STORE=array
ENV SESSION_DRIVER=array
ENV QUEUE_CONNECTION=sync
ENV DB_CONNECTION=sqlite
ENV DB_DATABASE=:memory:
ENV LOG_CHANNEL=stderr

# ============================================
# Install PHP dependencies
# --no-scripts first to avoid artisan triggering during install
# Then run post-autoload-dump with the safe env above
# ============================================
RUN composer install \
        --no-dev \
        --optimize-autoloader \
        --no-interaction \
        --no-scripts \
    && composer run-script post-autoload-dump --no-interaction || true

# ============================================
# Build frontend
# ============================================
RUN npm install --legacy-peer-deps \
    && npm install react-is@18.2.0 --legacy-peer-deps \
    && npm run build

# ============================================
# Storage directories + permissions
# ============================================
RUN mkdir -p \
        storage/framework/views \
        storage/framework/cache \
        storage/framework/sessions \
        storage/logs \
        storage/app/public \
    && touch storage/logs/laravel.log \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 777 /var/www/html/public

# ============================================
# Nginx template + supervisor config
# ============================================
COPY nginx.conf.template /etc/nginx/http.d/default.conf.template
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ============================================
# Entrypoint
# ============================================
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]