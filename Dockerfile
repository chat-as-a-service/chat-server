FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY build/ .

CMD [ "node", "index.js" ]
# tsc && docker buildx build --push -t coldcup2020/wingflo-chat-server:v0.1.5 --platform linux/amd64 .

