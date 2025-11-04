#!/bin/bash

# MCP Server Test Script
# Testet alle wichtigen Endpoints

set -e

MCP_URL="${MCP_URL:-http://localhost:8787}"
API_KEY="${API_KEY:-your-api-key}"

echo "🧪 MCP Server Tests"
echo "==================="
echo "Server: $MCP_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

function test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/mcp_test_response.json "$MCP_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -o /tmp/mcp_test_response.json \
            -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $API_KEY" \
            "$MCP_URL$endpoint" \
            -d "$data")
    fi
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL (HTTP $response)${NC}"
        cat /tmp/mcp_test_response.json
        echo ""
        return 1
    fi
}

# Health Check
echo "1. Health Check"
test_endpoint "Health" "GET" "/health" ""
echo ""

# Manifest
echo "2. Manifest"
test_endpoint "Manifest" "GET" "/mcp/manifest" ""
echo ""

# Cert Scan (requires valid API key)
if [ "$API_KEY" != "your-api-key" ]; then
    echo "3. Cert Tools (mit API-Key)"
    
    test_endpoint "cert.scan" "POST" "/mcp/tools/cert.scan" \
        '{"host":"google.com","port":443}'
    
    test_endpoint "cert.expiry" "POST" "/mcp/tools/cert.expiry" \
        '{"host":"google.com","warnDays":30}'
    
    test_endpoint "security.anomalyScan" "POST" "/mcp/tools/security.anomalyScan" \
        '{"host":"google.com"}'
    
    echo ""
else
    echo "⚠️  Skipping tool tests (API_KEY not set)"
    echo "   Set API_KEY environment variable to test authenticated endpoints"
    echo ""
fi

echo "==================="
echo "Tests abgeschlossen!"

# Cleanup
rm -f /tmp/mcp_test_response.json

