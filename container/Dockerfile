FROM node:18-alpine 

RUN apt update 
RUN apt upgrade -y
RUN apt add --no--cache ffmpeg

WORKDIR /app

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY index.js .
COPY .env .

CMD [ "npm","run","dev" ]