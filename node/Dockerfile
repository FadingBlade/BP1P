FROM golang:1.24-alpine AS build
WORKDIR /src
COPY node/go.mod ./
RUN go mod download
COPY node/main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/bp1p-node .
FROM alpine:3.22
RUN adduser -D -H bp1p
USER bp1p
WORKDIR /srv/bp1p
COPY --from=build /out/bp1p-node /usr/local/bin/bp1p-node
ENTRYPOINT ["bp1p-node"]
