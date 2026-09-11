#!/usr/bin/env bash
# ==============================================================================
# RevenuePilot — Docker Connectivity Test Script
# Tests all services and cross-service communication
#
# Usage:
#   bash test_connectivity.sh
# ==============================================================================

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  RevenuePilot — Connectivity Tests${NC}"
    echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════${NC}"
    echo ""
}

check() {
    local name="$1"
    local url="$2"
    local expected_pattern="${3:-}"

    printf "  %-50s" "Testing: $name ..."
    
    response=$(curl -sf --max-time 10 "$url" 2>/dev/null || true)
    http_code=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [[ "$http_code" =~ ^(200|301|302)$ ]]; then
        if [[ -n "$expected_pattern" ]] && ! echo "$response" | grep -q "$expected_pattern" 2>/dev/null; then
            echo -e "${YELLOW}⚠  WARN${NC} (HTTP $http_code, pattern '$expected_pattern' not found)"
            ((FAIL++))
        else
            echo -e "${GREEN}✓  PASS${NC} (HTTP $http_code)"
            ((PASS++))
        fi
    else
        echo -e "${RED}✗  FAIL${NC} (HTTP $http_code)"
        ((FAIL++))
    fi
}

check_container_health() {
    local container="$1"
    printf "  %-50s" "Container health: $container ..."
    
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    
    if [[ "$status" == "healthy" ]]; then
        echo -e "${GREEN}✓  healthy${NC}"
        ((PASS++))
    elif [[ "$status" == "not_found" ]]; then
        echo -e "${RED}✗  not found${NC}"
        ((FAIL++))
    else
        echo -e "${YELLOW}⚠  $status${NC}"
        ((FAIL++))
    fi
}

check_cross_service() {
    local name="$1"
    local container="$2"
    local url="$3"

    printf "  %-50s" "Cross-service: $name ..."
    
    response=$(docker exec "$container" curl -sf --max-time 10 "$url" 2>/dev/null || true)
    exit_code=$?
    
    if [[ $exit_code -eq 0 ]] && [[ -n "$response" ]]; then
        echo -e "${GREEN}✓  PASS${NC}"
        ((PASS++))
    else
        echo -e "${RED}✗  FAIL${NC}"
        ((FAIL++))
    fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
print_header

echo -e "${BOLD}[1/4] Waiting for services to be ready...${NC}"
sleep 5
echo ""

# ── Container Health ───────────────────────────────────────────────────────────
echo -e "${BOLD}[2/4] Container Health Status${NC}"
check_container_health "revenuepilot_store_backend"
check_container_health "revenuepilot_ai"
check_container_health "revenuepilot_store_frontend"
check_container_health "revenuepilot_merchant_frontend"
echo ""

# ── External Endpoint Tests ────────────────────────────────────────────────────
echo -e "${BOLD}[3/4] External Endpoint Reachability${NC}"

# Store Backend
check "Store Backend — Root"          "http://localhost:8000/"           "RevenuePilot"
check "Store Backend — Health"        "http://localhost:8000/health"     "healthy"
check "Store Backend — API Docs"      "http://localhost:8000/api/v1/docs"

# AI Service
check "AI Service — Root"             "http://localhost:8001/"           "RevenuePilot AI"
check "AI Service — Health"           "http://localhost:8001/health"     "healthy"
check "AI Service — Docs"             "http://localhost:8001/docs"

# Store Frontend
check "Store Frontend — HTML"         "http://localhost:3000/"
check "Store Frontend — API Proxy"    "http://localhost:3000/api/v1/health" "healthy"

# Merchant Frontend
check "Merchant Frontend — HTML"      "http://localhost:3001/"
check "Merchant Frontend — API Proxy" "http://localhost:3001/api/v1/health" "healthy"
check "Merchant Frontend — AI Proxy"  "http://localhost:3001/ai/health"     "healthy"
echo ""

# ── Cross-Service (Container → Container) ─────────────────────────────────────
echo -e "${BOLD}[4/4] Cross-Service Container-to-Container Communication${NC}"
check_cross_service "AI → Store Backend health"      "revenuepilot_ai"       "http://store-backend:8000/health"
check_cross_service "Store Frontend → Store Backend" "revenuepilot_store_frontend" "http://store-backend:8000/health"
check_cross_service "Merchant → Store Backend"       "revenuepilot_merchant_frontend" "http://store-backend:8000/health"
check_cross_service "Merchant → AI Service"          "revenuepilot_merchant_frontend" "http://revenuepilot-ai:8001/health"
echo ""

# ── Summary ────────────────────────────────────────────────────────────────────
echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}All $TOTAL tests passed! ✓${NC}"
    echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}Service URLs:${NC}"
    echo -e "  • Store Customer App:      ${GREEN}http://localhost:3000${NC}"
    echo -e "  • Merchant Dashboard:      ${GREEN}http://localhost:3001${NC}"
    echo -e "  • Store API (Swagger):     ${GREEN}http://localhost:8000/api/v1/docs${NC}"
    echo -e "  • AI Service (Swagger):    ${GREEN}http://localhost:8001/docs${NC}"
    exit 0
else
    echo -e "  ${RED}${BOLD}$FAIL/$TOTAL tests FAILED${NC}"
    echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${YELLOW}Troubleshooting:${NC}"
    echo -e "  • View logs: ${BOLD}docker compose logs -f${NC}"
    echo -e "  • Restart:   ${BOLD}docker compose restart${NC}"
    exit 1
fi
