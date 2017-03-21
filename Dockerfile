FROM mhart/alpine-node:6

COPY package.json /tmp/package.json

RUN cd /tmp/ && npm install --production

RUN mkdir -p /usr/src/app && cp -a /tmp/node_modules /usr/src/app

WORKDIR /usr/src/app

COPY . /usr/src/app

ENTRYPOINT  ["npm", "start"]