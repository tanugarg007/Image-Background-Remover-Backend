
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --onnxruntime-node-install-cuda=skip

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["node", "--max-old-space-size=384", "build/index.js"]
