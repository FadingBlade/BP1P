FROM node:24-alpine
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY node/server.mjs ./server.mjs
EXPOSE 8081 8787
CMD ["node", "server.mjs"]
