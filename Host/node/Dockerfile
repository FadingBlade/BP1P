FROM node:24-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY Host/node/server.mjs ./server.mjs
COPY Host/node/admin-console.html ./admin-console.html
EXPOSE 8081 8787
CMD ["node", "server.mjs"]
