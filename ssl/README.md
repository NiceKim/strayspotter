# SSL Certificates

Please place your SSL certificates in this directory before starting the application:

1. `fullchain.pem` - The full certificate chain
2. `privkey.pem` - The private key

The `nginx` container is configured to look for these files at `/etc/nginx/ssl/fullchain.pem` and `/etc/nginx/ssl/privkey.pem` respectively. If they are missing, the nginx container may fail to start.
