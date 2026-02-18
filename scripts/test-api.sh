#!/usr/bin/env bash
# Тест основных API endpoints через curl
set -e

BASE="http://localhost:3001/api/v1"
EMAIL="test-$(date +%s)@example.com"
PASS="password123"

echo "=== 1. Health check (GET /api/v1) ==="
curl -s "$BASE" | head -1
echo -e "\n"

echo "=== 2. Register (POST /auth/register) ==="
REG=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"companyName\":\"Test Co\",\"password\":\"$PASS\",\"confirmPassword\":\"$PASS\"}")
echo "$REG" | head -c 200
echo -e "\n"

echo "=== 3. Login (POST /auth/login) ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LOGIN" | head -c 300
TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
echo -e "\nToken: ${TOKEN:0:50}..."

if [ -z "$TOKEN" ]; then
  echo "ERROR: No token received. Login response: $LOGIN"
  exit 1
fi

echo -e "\n=== 4. Auth me (GET /auth/me) ==="
curl -s "$BASE/auth/me" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 5. Users me (GET /users/me) ==="
curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 6. Companies me (GET /companies/me) ==="
curl -s "$BASE/companies/me" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 7. Projects (GET /projects) ==="
curl -s "$BASE/projects" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 8. Organizations (GET /organizations) ==="
curl -s "$BASE/organizations" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 9. Time entries (GET /time-entries) ==="
curl -s "$BASE/time-entries" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 10. Notifications (GET /notifications) ==="
curl -s "$BASE/notifications" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 11. Notifications unread count (GET /notifications/unread-count) ==="
curl -s "$BASE/notifications/unread-count" -H "Authorization: Bearer $TOKEN" | head -c 100
echo -e "\n"

echo "=== 12. Team activity (GET /team-activity) ==="
curl -s "$BASE/team-activity" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 13. Blocked URLs (GET /blocked-urls) ==="
curl -s "$BASE/blocked-urls" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 14. Idle status (GET /idle/status) ==="
curl -s "$BASE/idle/status" -H "Authorization: Bearer $TOKEN" | head -c 200
echo -e "\n"

echo "=== 15. Unauthorized (GET /users/me without token) ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users/me")
echo "HTTP $STATUS (expected 401)"
echo -e "\n"

echo "✅ All tests completed"
