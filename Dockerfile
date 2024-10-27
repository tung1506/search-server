# Use the official Node.js image as the base
FROM node:20-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . ./

# Expose the application's port
EXPOSE 3000
EXPOSE 9200

# Command to run the application
CMD npm run start
