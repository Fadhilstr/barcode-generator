# ============================================================
# Dockerfile — Frontend Quasar (Node.js Dev Server)
# ============================================================
FROM node:20-slim

WORKDIR /app

# Copy dependency definition
COPY package*.json ./

# Install dependencies (ignore scripts during package install)
RUN npm install --ignore-scripts

# Copy seluruh source code frontend
COPY . .

# Jalankan quasar prepare setelah seluruh file project disalin
RUN npx quasar prepare --silent

EXPOSE 9000

# Jalankan Quasar dev server pada host 0.0.0.0 port 9000
CMD ["npx", "quasar", "dev", "-p", "9000", "--hostname", "0.0.0.0"]
