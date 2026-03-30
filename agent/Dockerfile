FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o agent .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates && \
    addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

WORKDIR /home/appuser

COPY --from=builder --chown=appuser:appuser /app/agent .

USER appuser

EXPOSE 8080

CMD ["./agent"]


