@echo off
setlocal

REM MCP Server Test Script for Windows
REM Testet alle wichtigen Endpoints

set MCP_URL=http://localhost:8787
set API_KEY=your-api-key

echo MCP Server Tests
echo ==================
echo Server: %MCP_URL%
echo.

REM Health Check
echo 1. Health Check
curl -s %MCP_URL%/health
echo.
echo.

REM Manifest
echo 2. Manifest
curl -s %MCP_URL%/mcp/manifest
echo.
echo.

if NOT "%API_KEY%"=="your-api-key" (
    echo 3. Cert Tools ^(mit API-Key^)
    
    echo Testing cert.scan...
    curl -s -X POST %MCP_URL%/mcp/tools/cert.scan ^
        -H "Content-Type: application/json" ^
        -H "X-API-Key: %API_KEY%" ^
        -d "{\"host\":\"google.com\",\"port\":443}"
    echo.
    
    echo Testing cert.expiry...
    curl -s -X POST %MCP_URL%/mcp/tools/cert.expiry ^
        -H "Content-Type: application/json" ^
        -H "X-API-Key: %API_KEY%" ^
        -d "{\"host\":\"google.com\",\"warnDays\":30}"
    echo.
) else (
    echo WARNING: Skipping tool tests ^(API_KEY not set^)
    echo    Set API_KEY environment variable to test authenticated endpoints
)

echo.
echo ==================
echo Tests abgeschlossen!

endlocal

