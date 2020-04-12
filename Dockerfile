FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

VOLUME /config

EXPOSE 2101
CMD [ "node", "app.js" ]
