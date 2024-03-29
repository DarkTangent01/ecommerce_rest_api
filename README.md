# APPLICATION NAME: E-COMMERCE-REST-API

## APPLICATION IS UNDER DEVELOPMENT

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
APP_URL = YOUR_HOST_URL example: http://localhost:5000/
DEBUG_MODE = "true || false (true for development env and for production env set to false)"
DB_URL = "YOUR-MONGODB-URL"
JWT_SECRET = "YOUR_JWT_SECRET_KEY (MAKE THIS STRONG) (DO NOT MAKE SAME AS 'REFRESH_SECRET')"
REFRESH_SECRET = "YOUR_REFRESH_SECRET_KEY (MAKE THIS STRONG)"
```

## User Routes APIs
``` bash
http://<APP_IP_ADDRESS>:<APP_PORT>/register/ [this api route is for register user] [Route Type: POST]
http://<APP_IP_ADDRESS>:<APP_PORT>/login/ [this api route is for login user] [Route Type: POST]
http://<APP_IP_ADDRESS>:<APP_PORT>/refresh/ [this api route is for refresh the refresh_token] [Route Type: POST]
http://<APP_IP_ADDRESS>:<APP_PORT>/logout/ [this api route is for logout the user] [Route Type: POST]
http://<APP_IP_ADDRESS>:<APP_PORT>/users/ [this api route is for identify the user using access_token] [Route Type: GET]
```

## Product Routes APIs
``` bash
http://<APP_IP_ADDRESS>:<APP_PORT>/products/ [this api route is for create products] [Route Type: POST]
http://<APP_IP_ADDRESS>:<APP_PORT>/products/:id [this api route is for update products details] [Route Type: PUT]
http://<APP_IP_ADDRESS>:<APP_PORT>/products/:id [this api route is for delete the product] [Route Type: DELETE]
http://<APP_IP_ADDRESS>:<APP_PORT>/products [this api route is for retrive all products from the database] [Route Type: GET]
http://<APP_IP_ADDRESS>:<APP_PORT>/products/:id [this api route is for retrive single products from the database] [Route Type: GET]
```

## DEVELOPER NAME

Mayank Srivastava
