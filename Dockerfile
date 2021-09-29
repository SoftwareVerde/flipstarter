FROM node:14-alpine
RUN apk add python make gcc g++ git
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
CMD ["npm", "start"]
