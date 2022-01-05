FROM node:12.18.3-slim

RUN apt-get update -y

RUN apt-get install git wget openssl -y

RUN update-ca-certificates
# Add non root user

RUN mkdir -p /app

ENV APP_HOME=/app

COPY package.json yarn.lock $APP_HOME/
COPY config $APP_HOME/config

WORKDIR $APP_HOME

RUN yarn install

COPY . $APP_HOME

RUN yarn build

RUN rm -rf node_modules
RUN yarn install --prod


FROM node:12.18.3-slim

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app

COPY --from=0 /app/node_modules /app/node_modules
COPY --from=0 /app/dist /app
COPY --from=0 /app/config /app/config
COPY env_secrets_expand.sh /app
COPY --from=0 /app/package.json /app

RUN groupadd --gid 992 merrymaker \
  && useradd --uid 992 --gid merrymaker merrymaker --shell /bin/bash

RUN chown -R merrymaker:merrymaker /app

USER merrymaker

ENTRYPOINT ["bash", "/app/env_secrets_expand.sh"]

WORKDIR /app
CMD ["bash", "-c", "node /app/worker.js"]
