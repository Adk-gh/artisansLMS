# Use an official PHP image with Apache
FROM php:8.2-apache

# Install database extensions and enable Apache URL rewriting (crucial for APIs)
RUN docker-php-ext-install mysqli pdo pdo_mysql && docker-php-ext-enable mysqli
RUN a2enmod rewrite

# Install Git and Unzip (Composer requires these to download packages)
RUN apt-get update && apt-get install -y git unzip

# Grab Composer from its official Docker image
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy your local code into the web server directory
COPY . /var/www/html/

# Run Composer to install PHPMailer (This fixes the "server configuring" error!)
RUN cd /var/www/html && composer install --no-dev --optimize-autoloader

# Set correct permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port 80 (Apache's default)
EXPOSE 80