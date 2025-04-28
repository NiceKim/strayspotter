FROM node:18

WORKDIR /app

# Copy package.json and package-lock.json files
COPY package*.json ./

# Install dependencies with force
RUN npm install --force

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application in development mode
CMD ["npm", "run", "dev"]