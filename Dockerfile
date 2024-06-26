FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN apt-get update && apt-get install -y ffmpeg

EXPOSE 8080

CMD [ "node", "index.js" ]
