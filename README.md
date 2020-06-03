# Flipstarter

## Run the development server

You need [NodeJS](https://nodejs.org/en/) installed on your machine, then run:

```shell
npm install
npm start
```

And open up [localhost:3000](http://localhost:3000) in your browser.

## Run the Docker container

You need [Docker](https://www.docker.com) installed on your machine, then run:

```shell
docker build -t flipstarter .
docker volume create flipstarter
docker run --name flipstarter -v flipstarter:/app -p 3000:3000 flipstarter
```

And open up [localhost:3000](http://localhost:3000) in your browser.

## Deploy to production

There are multiple ways to do this.

1. Use Digital Ocean Marketplace (coming soon)
2. Use a NodeJS image and serve `server.js` on port 80 or 443. You can also use a process manager like [pm2](https://pm2.keymetrics.io)
3. Deploy the docker container on port 80 or 443 using the following commands:

```
# download the latest version of flipstarter
docker pull flipstarter/flipstarter

# create a volume to store the database
docker volume create flipstarter

# run the container on ports 443 and 80
docker run -d --name flipstarter -v flipstarter:/app -p 443:3000 -p 80:3000 flipstarter/flipstarter
```

You can start and stop the container with `docker [start/stop] flipstarter`.

## Contribute

Submit pull requests at https://gitlab.com/flipstarter/backend
