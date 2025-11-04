#!/bin/bash
set -e

echo "Starting MCP Server Development Environment..."

# Check if Redis is running
if ! docker ps | grep -q redis; then
    echo "Redis not running. Starting Redis container..."
    docker run -d -p 6379:6379 --name certwatcher-redis redis:7-alpine
fi

# Start MCP Server in development mode
echo "Starting MCP Server..."
npm run dev

