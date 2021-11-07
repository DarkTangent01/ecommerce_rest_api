# APPLICATION NAME: E-COMMERCE-REST-API
## APPLICATION IS UNDER DEVELOPMENT

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://travis-ci.org/joemccann/dillinger)

## BUILD WITH

- NODE JS
- EXPRESS JS
- MONGO DB

## Installation

Install the dependencies and devDependencies and start the server.

```bash
git clone https://github.com/DarkTangent01/ecommerce_rest_api.git
cd ecommerce_rest_api
yarn install
yarn run dev [for development]
yarn start [for production]
```
## .env

```bash
APP_PORT = YOUR-HOST-PORT
APP_IP_ADDRESS = YOUR_HOST-IP-ADDRESS
DEBUG_MODE = "true || false (true for development env and for production env set to false)"
DB_URL = "YOUR-MONGODB-URL"
JWT_SECRET = "YOUR_JWT_SECRET_KEY (MAKE THIS STRONG) (DO NOT MAKE SAME AS 'REFRESH_SECRET')"
REFRESH_SECRET = "YOUR_REFRESH_SECRET_KEY (MAKE THIS STRONG)"
```

## DEVELOPER NAME
Mayank Srivastava