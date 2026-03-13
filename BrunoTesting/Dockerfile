FROM node:24-alpine

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

RUN npm install --global @usebruno/cli

WORKDIR /workspace/BrunoTesting/BugBoard

ENTRYPOINT ["bru"]
