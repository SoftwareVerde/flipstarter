FROM node:12-alpine3.10
RUN apk add python make gcc g++ git
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
CMD ["npm", "start"]
