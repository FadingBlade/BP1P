FROM node:24-alpine
WORKDIR /app
COPY Host/directory/server.mjs ./server.mjs
COPY Host/directory/admin-console.html ./admin-console.html
EXPOSE 8080 8790
CMD ["node", "server.mjs"]
