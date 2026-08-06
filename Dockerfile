FROM node:20-alpine

WORKDIR /app

# Copy root and workspace package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build both backend and frontend
RUN npm run build

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["node", "backend/dist/index.js"]
