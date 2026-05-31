FROM golang:1.25-alpine AS builder

# Install build dependencies for CGO (SQLite compiler requirements)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Pre-copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code files
COPY . .

# Compile Go executable with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o secureaccess-api .

# Final stage runner
FROM alpine:latest
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY --from=builder /app/secureaccess-api .

# Expose port
EXPOSE 8080

# Execute server binary
CMD ["./secureaccess-api"]
