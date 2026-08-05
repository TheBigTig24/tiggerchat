# Node image
FROM node:20-alpine

# set working dir
WORKDIR /app

# copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copies application code
COPY . .

# generate prisma client
RUN npx prisma generate

# expose necessary ports 
EXPOSE 3000
EXPOSE 3001

# start dev server
CMD ["npm", "run", "dev"]