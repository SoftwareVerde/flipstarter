FROM node:12.22-alpine3.14
RUN apk add python make gcc g++ git
WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm install
COPY . /app
CMD ["npm", "start"]
