# Flipstarter

## Run the development server

You need [NodeJS](https://nodejs.org/en/) and Git installed on your machine, then run:

```shell
npm install
npm start
```

And open up [localhost:3000](http://localhost:3000) in your browser.

## Run the Docker container

You need Docker installed on your machine, then run:

```shell
docker build -t flipstarter .
docker run -it -p 3000:3000 flipstarter
```

And open up [localhost:3000](http://localhost:3000) in your browser.
