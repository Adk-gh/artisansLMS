# Use an official PHP image with Apache
FROM php:8.2-apache

# Install the MySQL extension so your PHP can talk to the database
RUN docker-php-ext-install mysqli && docker-php-ext-enable mysqli

# Copy your local code into the web server directory
COPY . /var/www/html/

# Set correct permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port 80 (Apache's default)
EXPOSE 80