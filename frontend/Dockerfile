FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# COPY ONLY WHAT IS NEEDED
COPY .next .next
COPY public ./public

EXPOSE 3001
CMD ["npm", "start"]