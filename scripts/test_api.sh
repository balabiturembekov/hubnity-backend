#!/usr/bin/env bash
#
# Hubnity API — Comprehensive Test Suite
# Role: Senior QA Automation Engineer (Backend)
#
# Prerequisites: curl, jq (optional, for JSON parsing)
# Server must be running: npm run dev (or start:prod)
# Usage: ./scripts/test_api.sh [BASE_URL]
# Default BASE_URL: http://localhost:3001/api/v1
# Set DEBUG=1 to print response bodies on failures (e.g. DEBUG=1 ./scripts/test_api.sh)
#
set -e

BASE="${1:-http://localhost:3001/api/v1}"
DEBUG="${DEBUG:-0}"
PASS="password123"
TS=$(date +%s)
EMAIL_OWNER="owner-${TS}@example.com"
EMAIL_EMPLOYEE="employee-${TS}@example.com"
EMAIL_MANAGER="manager-${TS}@example.com"

# Counters
PASSED=0
FAILED=0

# Minimal valid 1x1 PNG (base64)
SMALL_PNG_BASE64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

assert_status() {
  local actual=$1
  local expected=$2
  local name=$3
  local body="${4:-}"
  if [ "$actual" = "$expected" ]; then
    echo "  ✓ $name (HTTP $actual)"
    ((PASSED++)) || true
    return 0
  else
    echo "  ✗ $name (expected $expected, got $actual)"
    [ "$DEBUG" = "1" ] && [ -n "$body" ] && echo "    [DEBUG] Response: $body"
    ((FAILED++)) || true
    return 1
  fi
}

assert_json_contains() {
  local json=$1
  local pattern=$2
  local name=$3
  if echo "$json" | grep -q "$pattern"; then
    echo "  ✓ $name"
    ((PASSED++)) || true
    return 0
  else
    echo "  ✗ $name (pattern not found: $pattern)"
    ((FAILED++)) || true
    return 1
  fi
}

# Wrapper for curl that captures status and body
curl_test() {
  local method=$1
  local url=$2
  local data=$3
  local token=$4
  local extra_headers=$5
  local out=$(mktemp)
  local headers="-H Content-Type: application/json"
  [ -n "$token" ] && headers="$headers -H Authorization: Bearer $token"
  [ -n "$extra_headers" ] && headers="$headers $extra_headers"
  local status
  if [ -n "$data" ]; then
    status=$(curl -s -o "$out" -w "%{http_code}" -X "$method" "$url" $headers -d "$data")
  else
    status=$(curl -s -o "$out" -w "%{http_code}" -X "$method" "$url" $headers)
  fi
  cat "$out"
  echo "__HTTP_STATUS__$status"
  rm -f "$out"
}

echo "=============================================="
echo "Hubnity API Test Suite"
echo "BASE_URL: $BASE"
echo "=============================================="

# =============================================================================
# SETUP: Register owner, create project, employee, manager
# =============================================================================
echo ""
echo "=== SETUP ==="

echo "Registering owner..."
REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Owner User\",\"email\":\"$EMAIL_OWNER\",\"companyName\":\"Test Co\",\"password\":\"$PASS\",\"confirmPassword\":\"$PASS\"}")
TOKEN_OWNER=$(echo "$REG" | jq -r '.access_token // empty' 2>/dev/null || echo "$REG" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
USER_ID_OWNER=$(echo "$REG" | jq -r '.user.id // empty' 2>/dev/null || echo "$REG" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
COMPANY_ID=$(echo "$REG" | jq -r '.user.companyId // empty' 2>/dev/null || echo "$REG" | grep -o '"companyId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN_OWNER" ]; then
  echo "ERROR: Registration failed. Response: $REG"
  exit 1
fi
echo "  Owner registered, token obtained"

echo "Creating project..."
PROJ_RESP=$(curl -s -X POST "$BASE/projects" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","description":"For API tests"}')
PROJECT_ID=$(echo "$PROJ_RESP" | jq -r '.id // empty' 2>/dev/null || echo "$PROJ_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: Project creation failed. Response: $PROJ_RESP"
  exit 1
fi
echo "  Project created: $PROJECT_ID"

echo "Creating employee..."
EMP_RESP=$(curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Employee User\",\"email\":\"$EMAIL_EMPLOYEE\",\"password\":\"$PASS\",\"role\":\"EMPLOYEE\"}")
USER_ID_EMPLOYEE=$(echo "$EMP_RESP" | jq -r '.id // empty' 2>/dev/null || echo "$EMP_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$USER_ID_EMPLOYEE" ]; then
  echo "ERROR: Employee creation failed. Response: $EMP_RESP"
  exit 1
fi
echo "  Employee created: $USER_ID_EMPLOYEE"

echo "Creating manager..."
MGR_RESP=$(curl -s -X POST "$BASE/users" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Manager User\",\"email\":\"$EMAIL_MANAGER\",\"password\":\"$PASS\",\"role\":\"MANAGER\"}")
USER_ID_MANAGER=$(echo "$MGR_RESP" | jq -r '.id // empty' 2>/dev/null || echo "$MGR_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$USER_ID_MANAGER" ]; then
  echo "  WARN: Manager creation failed (MANAGER role may require migration). Skipping manager-specific RBAC tests."
  HAS_MANAGER=false
else
  HAS_MANAGER=true
  echo "  Manager created: $USER_ID_MANAGER"
  echo "Logging in as manager..."
  LOGIN_MGR=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL_MANAGER\",\"password\":\"$PASS\"}")
  TOKEN_MANAGER=$(echo "$LOGIN_MGR" | jq -r '.access_token // empty' 2>/dev/null || echo "$LOGIN_MGR" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$TOKEN_MANAGER" ]; then
    echo "  WARN: Manager login failed. Using owner token."
    TOKEN_MANAGER="$TOKEN_OWNER"
  fi
fi

echo "Logging in as employee..."
LOGIN_EMP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_EMPLOYEE\",\"password\":\"$PASS\"}")
TOKEN_EMPLOYEE=$(echo "$LOGIN_EMP" | jq -r '.access_token // empty' 2>/dev/null || echo "$LOGIN_EMP" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN_EMPLOYEE" ]; then
  echo "ERROR: Employee login failed. Response: $LOGIN_EMP"
  exit 1
fi

# =============================================================================
# 1. AUTH FLOW
# =============================================================================
echo ""
echo "=== 1. AUTH FLOW ==="

echo "1.1 Login with valid credentials"
RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_OWNER\",\"password\":\"$PASS\"}")
BODY=$(echo "$RESP" | sed '/__HTTP__/d')
STATUS=$(echo "$RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$STATUS" "200" "Login valid -> 200" || true
assert_json_contains "$BODY" "access_token" "Response contains access_token" || true

echo "1.2 Login with invalid credentials"
RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid@example.com","password":"wrongpass"}')
STATUS=$(echo "$RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$STATUS" "401" "Login invalid -> 401" || true

echo "1.3 Access protected route without token"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users/me")
assert_status "$STATUS" "401" "GET /users/me without token -> 401" || true

echo "1.4 Token refresh"
REFRESH_TOKEN=$(echo "$REG" | jq -r '.refresh_token // empty' 2>/dev/null || echo "$REG" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$REFRESH_TOKEN" ]; then
  REFRESH_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
  REFRESH_STATUS=$(echo "$REFRESH_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  assert_status "$REFRESH_STATUS" "200" "Refresh token -> 200" || true
else
  echo "  - Refresh token test skipped (no refresh_token in register response)"
fi

# =============================================================================
# 2. TIME TRACKING LOGIC
# =============================================================================
echo ""
echo "=== 2. TIME TRACKING LOGIC ==="

echo "2.1 POST /time-entries — Start a timer"
START_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID_EMPLOYEE\",\"projectId\":\"$PROJECT_ID\",\"description\":\"Test work\"}")
START_BODY=$(echo "$START_RESP" | sed '/__HTTP__/d')
START_STATUS=$(echo "$START_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$START_STATUS" "201" "Start timer -> 201" "$START_BODY" || true
assert_json_contains "$START_BODY" "RUNNING" "Entry status is RUNNING" || true
ENTRY_ID=$(echo "$START_BODY" | jq -r '.id // empty' 2>/dev/null || echo "$START_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$ENTRY_ID" ]; then
  echo "  WARN: Could not extract entry ID for subsequent tests"
fi

echo "2.2 POST /time-entries (again) — Block second timer for same user"
SECOND_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID_EMPLOYEE\",\"projectId\":\"$PROJECT_ID\"}")
SECOND_STATUS=$(echo "$SECOND_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$SECOND_STATUS" "400" "Second timer blocked -> 400" || true
assert_json_contains "$(echo "$SECOND_RESP" | sed '/__HTTP__/d')" "active" "Error mentions active entry" || true

echo "2.3 PUT /time-entries/:id/pause — Pause the timer"
if [ -n "$ENTRY_ID" ]; then
  PAUSE_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PUT "$BASE/time-entries/$ENTRY_ID/pause" \
    -H "Authorization: Bearer $TOKEN_EMPLOYEE")
  PAUSE_STATUS=$(echo "$PAUSE_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  assert_status "$PAUSE_STATUS" "200" "Pause -> 200" || true
  assert_json_contains "$(echo "$PAUSE_RESP" | sed '/__HTTP__/d')" "PAUSED" "Status is PAUSED" || true
fi

echo "2.4 PUT /time-entries/:id/resume — Resume the timer"
if [ -n "$ENTRY_ID" ]; then
  RESUME_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PUT "$BASE/time-entries/$ENTRY_ID/resume" \
    -H "Authorization: Bearer $TOKEN_EMPLOYEE")
  RESUME_STATUS=$(echo "$RESUME_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  assert_status "$RESUME_STATUS" "200" "Resume -> 200" || true
  assert_json_contains "$(echo "$RESUME_RESP" | sed '/__HTTP__/d')" "RUNNING" "Status is RUNNING" || true
fi

echo "2.5 PUT /time-entries/:id/stop — Stop the timer"
if [ -n "$ENTRY_ID" ]; then
  STOP_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PUT "$BASE/time-entries/$ENTRY_ID/stop" \
    -H "Authorization: Bearer $TOKEN_EMPLOYEE")
  STOP_STATUS=$(echo "$STOP_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  assert_status "$STOP_STATUS" "200" "Stop -> 200" || true
  assert_json_contains "$(echo "$STOP_RESP" | sed '/__HTTP__/d')" "STOPPED" "Status is STOPPED" || true
fi

# =============================================================================
# 3. SYNC ENGINE
# =============================================================================
echo ""
echo "=== 3. SYNC ENGINE ==="

# Generate unique idempotency keys per run (valid UUID v4 format, avoid collisions)
BASE_UUID="550e8400-e29b-41d4-a716"
UUID1="${BASE_UUID}-$(printf "%012x" $((TS * 100 + 1)))"
UUID2="${BASE_UUID}-$(printf "%012x" $((TS * 100 + 2)))"
UUID3="${BASE_UUID}-$(printf "%012x" $((TS * 100 + 3)))"
UUID4="${BASE_UUID}-$(printf "%012x" $((TS * 100 + 4)))"
UUID5="${BASE_UUID}-$(printf "%012x" $((TS * 100 + 5)))"
START_ISO="2025-01-15T10:00:00.000Z"
END_ISO="2025-01-15T12:00:00.000Z"

echo "3.1 POST /time-entries/sync — Valid batch of 5 entries"
SYNC_BATCH='{"entries":[
  {"idempotencyKey":"'$UUID1'","userId":"'$USER_ID_EMPLOYEE'","projectId":"'$PROJECT_ID'","startTime":"'$START_ISO'","endTime":"'$END_ISO'","duration":7200,"status":"STOPPED"},
  {"idempotencyKey":"'$UUID2'","userId":"'$USER_ID_EMPLOYEE'","projectId":"'$PROJECT_ID'","startTime":"2025-01-16T09:00:00.000Z","endTime":"2025-01-16T11:00:00.000Z","duration":7200,"status":"STOPPED"},
  {"idempotencyKey":"'$UUID3'","userId":"'$USER_ID_EMPLOYEE'","projectId":"'$PROJECT_ID'","startTime":"2025-01-17T09:00:00.000Z","endTime":"2025-01-17T10:30:00.000Z","duration":5400,"status":"STOPPED"},
  {"idempotencyKey":"'$UUID4'","userId":"'$USER_ID_EMPLOYEE'","projectId":"'$PROJECT_ID'","startTime":"2025-01-18T08:00:00.000Z","endTime":"2025-01-18T09:00:00.000Z","duration":3600,"status":"STOPPED"},
  {"idempotencyKey":"'$UUID5'","userId":"'$USER_ID_EMPLOYEE'","projectId":"'$PROJECT_ID'","startTime":"2025-01-19T10:00:00.000Z","endTime":"2025-01-19T12:00:00.000Z","duration":7200,"status":"STOPPED"}
]}'
SYNC_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries/sync" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "$SYNC_BATCH")
SYNC_BODY=$(echo "$SYNC_RESP" | sed '/__HTTP__/d')
SYNC_STATUS=$(echo "$SYNC_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$SYNC_STATUS" "200" "Sync batch -> 200" "$SYNC_BODY" || true
assert_json_contains "$SYNC_BODY" "created" "Response has created count" || true
CREATED=$(echo "$SYNC_BODY" | jq -r '.created // 0' 2>/dev/null || echo "$SYNC_BODY" | grep -o '"created":[0-9]*' | cut -d: -f2)
echo "  Created: $CREATED entries"

echo "3.2 Idempotency check — Resend SAME batch (expect skipped)"
SYNC2_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries/sync" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "$SYNC_BATCH")
SYNC2_BODY=$(echo "$SYNC2_RESP" | sed '/__HTTP__/d')
SYNC2_STATUS=$(echo "$SYNC2_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$SYNC2_STATUS" "200" "Resend same batch -> 200" || true
assert_json_contains "$SYNC2_BODY" "skipped" "Response has skipped" || true
SKIPPED=$(echo "$SYNC2_BODY" | jq -r '.skipped // 0' 2>/dev/null || echo "$SYNC2_BODY" | grep -o '"skipped":[0-9]*' | cut -d: -f2)
if [ "${SKIPPED:-0}" -ge "5" ]; then
  echo "  ✓ All 5 entries skipped (no duplicates)"
  ((PASSED++)) || true
else
  echo "  ✗ Expected 5 skipped, got ${SKIPPED:-0}"
  ((FAILED++)) || true
fi
assert_json_contains "$SYNC2_BODY" '"action":"skipped"' "Entries have action skipped" || true

echo "3.3 Conflict check — Same idempotencyKey, different duration (expect 409)"
CONFLICT_BATCH='{"entries":[{"idempotencyKey":"'$UUID1'","userId":"'$USER_ID_EMPLOYEE'","projectId":"'$PROJECT_ID'","startTime":"'$START_ISO'","endTime":"'$END_ISO'","duration":9999,"status":"STOPPED"}]}'
CONFLICT_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries/sync" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "$CONFLICT_BATCH")
CONFLICT_STATUS=$(echo "$CONFLICT_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$CONFLICT_STATUS" "409" "Conflict (different duration) -> 409" || true

# =============================================================================
# 4. RBAC (Permissions)
# =============================================================================
echo ""
echo "=== 4. RBAC ==="

echo "4.1 EMPLOYEE tries PATCH /companies/me (admin route) -> 403"
PATCH_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PATCH "$BASE/companies/me" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacked Name"}')
PATCH_STATUS=$(echo "$PATCH_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$PATCH_STATUS" "403" "Employee PATCH /companies/me -> 403" || true

echo "4.2 MANAGER tries PATCH /companies/me (company settings) -> 403"
if [ "$HAS_MANAGER" = "true" ]; then
  MGR_PATCH_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PATCH "$BASE/companies/me" \
    -H "Authorization: Bearer $TOKEN_MANAGER" \
    -H "Content-Type: application/json" \
    -d '{"name":"Manager Changed"}')
  MGR_PATCH_STATUS=$(echo "$MGR_PATCH_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  assert_status "$MGR_PATCH_STATUS" "403" "Manager PATCH /companies/me -> 403" || true
else
  echo "  - Skipped (no manager user)"
fi

echo "4.3 MANAGER/ADMIN can approve subordinate's time (need pending entry)"
# Create a new entry as employee, stop it (pending), then owner/admin approves
EMP_ENTRY=$(curl -s -X POST "$BASE/time-entries" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID_EMPLOYEE\",\"projectId\":\"$PROJECT_ID\"}")
EMP_ENTRY_ID=$(echo "$EMP_ENTRY" | jq -r '.id // empty' 2>/dev/null || echo "$EMP_ENTRY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$EMP_ENTRY_ID" ]; then
  curl -s -X PUT "$BASE/time-entries/$EMP_ENTRY_ID/stop" -H "Authorization: Bearer $TOKEN_EMPLOYEE" >/dev/null
  APPROVE_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries/$EMP_ENTRY_ID/approve" \
    -H "Authorization: Bearer $TOKEN_OWNER")
  APPROVE_STATUS=$(echo "$APPROVE_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  # Approve returns 200 or 201 (both indicate success)
if [ "$APPROVE_STATUS" = "200" ] || [ "$APPROVE_STATUS" = "201" ]; then
  echo "  ✓ Admin approves subordinate -> $APPROVE_STATUS"
  ((PASSED++)) || true
else
  echo "  ✗ Admin approves subordinate (expected 200/201, got $APPROVE_STATUS)"
  ((FAILED++)) || true
fi
fi

echo "4.4 Self-approval blocked (user cannot approve own time)"
# Create entry as employee, stop it, employee tries to approve own -> 403
SELF_ENTRY=$(curl -s -X POST "$BASE/time-entries" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID_EMPLOYEE\",\"projectId\":\"$PROJECT_ID\"}")
SELF_ENTRY_ID=$(echo "$SELF_ENTRY" | jq -r '.id // empty' 2>/dev/null || echo "$SELF_ENTRY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$SELF_ENTRY_ID" ]; then
  curl -s -X PUT "$BASE/time-entries/$SELF_ENTRY_ID/stop" -H "Authorization: Bearer $TOKEN_EMPLOYEE" >/dev/null
  SELF_APPROVE_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/time-entries/$SELF_ENTRY_ID/approve" \
    -H "Authorization: Bearer $TOKEN_EMPLOYEE")
  SELF_APPROVE_STATUS=$(echo "$SELF_APPROVE_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  assert_status "$SELF_APPROVE_STATUS" "403" "Employee self-approve -> 403" || true
fi

# =============================================================================
# 5. SCREENSHOT UPLOAD
# =============================================================================
echo ""
echo "=== 5. SCREENSHOT UPLOAD ==="

# Need an active or stopped time entry for screenshots
SCREENSHOT_ENTRY=$(curl -s -X POST "$BASE/time-entries" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID_EMPLOYEE\",\"projectId\":\"$PROJECT_ID\"}")
SCREENSHOT_ENTRY_ID=$(echo "$SCREENSHOT_ENTRY" | jq -r '.id // empty' 2>/dev/null || echo "$SCREENSHOT_ENTRY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$SCREENSHOT_ENTRY_ID" ]; then
  echo "5.1 POST /screenshots — Upload small Base64 payload"
  SCREENSHOT_JSON=$(jq -n --arg te "$SCREENSHOT_ENTRY_ID" --arg img "$SMALL_PNG_BASE64" '{timeEntryId:$te,imageData:$img}' 2>/dev/null || echo "{\"timeEntryId\":\"$SCREENSHOT_ENTRY_ID\",\"imageData\":\"$SMALL_PNG_BASE64\"}")
  SCREENSHOT_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X POST "$BASE/screenshots" \
    -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
    -H "Content-Type: application/json" \
    -d "$SCREENSHOT_JSON")
  SCREENSHOT_STATUS=$(echo "$SCREENSHOT_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
  SCREENSHOT_BODY=$(echo "$SCREENSHOT_RESP" | sed '/__HTTP__/d')
  if [ "$SCREENSHOT_STATUS" != "201" ]; then
    echo "    [Response $SCREENSHOT_STATUS]: $SCREENSHOT_BODY"
  fi
  assert_status "$SCREENSHOT_STATUS" "201" "Screenshot upload -> 201" "$SCREENSHOT_BODY" || true
  assert_json_contains "$SCREENSHOT_BODY" "imageUrl" "Response has imageUrl" || true
  # Stop the entry for cleanup
  curl -s -X PUT "$BASE/time-entries/$SCREENSHOT_ENTRY_ID/stop" -H "Authorization: Bearer $TOKEN_EMPLOYEE" >/dev/null
else
  echo "  - Screenshot test skipped (no time entry)"
fi

# =============================================================================
# 6. ANALYTICS
# =============================================================================
echo ""
echo "=== 6. ANALYTICS ==="

echo "6.1 GET /analytics/hours-by-day — JSON structure"
ANALYTICS_RESP=$(curl -s -w "\n__HTTP__%{http_code}" "$BASE/analytics/hours-by-day?period=30days" \
  -H "Authorization: Bearer $TOKEN_OWNER")
ANALYTICS_BODY=$(echo "$ANALYTICS_RESP" | sed '/__HTTP__/d')
ANALYTICS_STATUS=$(echo "$ANALYTICS_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$ANALYTICS_STATUS" "200" "Hours-by-day -> 200" "$ANALYTICS_BODY" || true
assert_json_contains "$ANALYTICS_BODY" "period" "Response has period" || true
assert_json_contains "$ANALYTICS_BODY" "data" "Response has data" || true
assert_json_contains "$ANALYTICS_BODY" "date" "Response has date field" || true
assert_json_contains "$ANALYTICS_BODY" "hours" "Response has hours field" || true

# =============================================================================
# 7. HEALTH CHECK
# =============================================================================
echo ""
echo "=== 7. HEALTH CHECK ==="

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE")
assert_status "$HEALTH_STATUS" "200" "GET / (health) -> 200" || true

# =============================================================================
# 8. COMPANY TRACKING POLICIES
# =============================================================================
echo ""
echo "=== 8. COMPANY TRACKING POLICIES ==="

echo "8.1 GET Settings (Employee) — Employee can fetch tracking settings"
SETTINGS_GET_RESP=$(curl -s -w "\n__HTTP__%{http_code}" "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE")
SETTINGS_GET_BODY=$(echo "$SETTINGS_GET_RESP" | sed '/__HTTP__/d')
SETTINGS_GET_STATUS=$(echo "$SETTINGS_GET_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$SETTINGS_GET_STATUS" "200" "GET /companies/settings (Employee) -> 200" "$SETTINGS_GET_BODY" || true
assert_json_contains "$SETTINGS_GET_BODY" "screenshotIntervalMinutes" "Response contains screenshotIntervalMinutes" || true
assert_json_contains "$SETTINGS_GET_BODY" "idleDetectionEnabled" "Response contains idleDetectionEnabled" || true

echo "8.2 PATCH Settings (Employee - Unauthorized) — Employee cannot change settings"
PATCH_EMP_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PATCH "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE" \
  -H "Content-Type: application/json" \
  -d '{"screenshotIntervalMinutes":1}')
PATCH_EMP_STATUS=$(echo "$PATCH_EMP_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$PATCH_EMP_STATUS" "403" "Employee PATCH /companies/settings -> 403" || true

echo "8.3 PATCH Settings (Owner - Authorized) — Owner can change settings"
PATCH_OWNER_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PATCH "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{"screenshotIntervalMinutes":20,"idleDetectionEnabled":false}')
PATCH_OWNER_BODY=$(echo "$PATCH_OWNER_RESP" | sed '/__HTTP__/d')
PATCH_OWNER_STATUS=$(echo "$PATCH_OWNER_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
if [ "$PATCH_OWNER_STATUS" = "200" ] || [ "$PATCH_OWNER_STATUS" = "204" ]; then
  echo "  ✓ Owner PATCH /companies/settings -> $PATCH_OWNER_STATUS"
  ((PASSED++)) || true
else
  echo "  ✗ Owner PATCH /companies/settings (expected 200/204, got $PATCH_OWNER_STATUS)"
  [ "$DEBUG" = "1" ] && [ -n "$PATCH_OWNER_BODY" ] && echo "    [DEBUG] Response: $PATCH_OWNER_BODY"
  ((FAILED++)) || true
fi

echo "8.4 Verify Persistence & Redis Invalidation — GET returns updated values"
SETTINGS_VERIFY_RESP=$(curl -s -w "\n__HTTP__%{http_code}" "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_EMPLOYEE")
SETTINGS_VERIFY_BODY=$(echo "$SETTINGS_VERIFY_RESP" | sed '/__HTTP__/d')
SETTINGS_VERIFY_STATUS=$(echo "$SETTINGS_VERIFY_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$SETTINGS_VERIFY_STATUS" "200" "GET /companies/settings after PATCH -> 200" "$SETTINGS_VERIFY_BODY" || true
# Verify screenshotIntervalMinutes is 20
INTERVAL=$(echo "$SETTINGS_VERIFY_BODY" | jq -r '.screenshotIntervalMinutes // empty' 2>/dev/null || echo "$SETTINGS_VERIFY_BODY" | grep -o '"screenshotIntervalMinutes":[0-9]*' | cut -d: -f2)
if [ "$INTERVAL" = "20" ]; then
  echo "  ✓ screenshotIntervalMinutes persisted as 20"
  ((PASSED++)) || true
else
  echo "  ✗ screenshotIntervalMinutes expected 20, got $INTERVAL"
  ((FAILED++)) || true
fi
# Verify idleDetectionEnabled is false (check JSON contains the updated value)
if echo "$SETTINGS_VERIFY_BODY" | grep -qE '"idleDetectionEnabled"[[:space:]]*:[[:space:]]*false'; then
  echo "  ✓ idleDetectionEnabled persisted as false"
  ((PASSED++)) || true
else
  echo "  ✗ idleDetectionEnabled expected false in response"
  [ "$DEBUG" = "1" ] && echo "    [DEBUG] Response: $SETTINGS_VERIFY_BODY"
  ((FAILED++)) || true
fi

echo "8.5 Boundary Validation — screenshotIntervalMinutes 0 or 100 -> 400"
BOUNDARY_0_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PATCH "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{"screenshotIntervalMinutes":0}')
BOUNDARY_0_STATUS=$(echo "$BOUNDARY_0_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$BOUNDARY_0_STATUS" "400" "PATCH screenshotIntervalMinutes=0 -> 400" || true

BOUNDARY_100_RESP=$(curl -s -w "\n__HTTP__%{http_code}" -X PATCH "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{"screenshotIntervalMinutes":100}')
BOUNDARY_100_STATUS=$(echo "$BOUNDARY_100_RESP" | grep '__HTTP__' | sed 's/.*__HTTP__//')
assert_status "$BOUNDARY_100_STATUS" "400" "PATCH screenshotIntervalMinutes=100 -> 400" || true

# Restore settings for other tests (optional, keeps env clean)
curl -s -X PATCH "$BASE/companies/settings" \
  -H "Authorization: Bearer $TOKEN_OWNER" \
  -H "Content-Type: application/json" \
  -d '{"screenshotIntervalMinutes":10,"idleDetectionEnabled":true}' >/dev/null

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=============================================="
echo "SUMMARY"
echo "=============================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "❌ Some tests failed"
  exit 1
else
  echo ""
  echo "✅ All tests passed"
  exit 0
fi
