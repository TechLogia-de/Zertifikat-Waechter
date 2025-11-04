@echo off
echo Starting MCP Server Development Environment...

REM Check if Redis is running
docker ps | findstr redis >nul
if %errorlevel% neq 0 (
    echo Redis not running. Starting Redis container...
    docker run -d -p 6379:6379 --name certwatcher-redis redis:7-alpine
)

REM Start MCP Server in development mode
echo Starting MCP Server...
npm run dev

