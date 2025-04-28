# Build the Node.js backend
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]