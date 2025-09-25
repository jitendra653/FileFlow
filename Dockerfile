FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm install --production
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
