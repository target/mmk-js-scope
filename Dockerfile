FROM buildkite/puppeteer:5.2.1

RUN apt-get update -y

RUN apt-get install git wget openssl -y

RUN update-ca-certificates
# Add non root user

RUN mkdir -p /app

ENV APP_HOME=/app

COPY package.json yarn.lock $APP_HOME/
COPY config $APP_HOME/config


RUN yarn install

COPY . $APP_HOME

WORKDIR $APP_HOME

RUN yarn build

RUN rm -rf node_modules
RUN yarn install --prod


FROM buildkite/puppeteer:5.2.1

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
