#!/bin/bash
export PATH="/usr/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
CURL=/usr/bin/curl
PYTHON=/opt/homebrew/bin/python3
BASE="http://localhost:8007/v1"
RESULTS="/Users/arome/Downloads/AI/ikpa/gps-test-results.txt"

cat > "$RESULTS" <<'HEADER'
=============================================
GPS RE-ROUTER ENDPOINT TEST RESULTS
=============================================
HEADER
echo "Date: $(date)" >> "$RESULTS"
echo "Base URL: $BASE" >> "$RESULTS"
echo "Account: legendabrahamonoja@gmail.com (Abraham Onoja)" >> "$RESULTS"
echo "" >> "$RESULTS"

# ---- LOGIN ----
echo ">> Logging in..."
LOGIN=$($CURL -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"legendabrahamonoja@gmail.com","password":"Xxxploit_18"}')

TOKEN=$(echo "$LOGIN" | $PYTHON -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
USER_ID=$(echo "$LOGIN" | $PYTHON -c "import sys,json; print(json.load(sys.stdin)['data']['user']['id'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FATAL: Login failed" >> "$RESULTS"
  echo "$LOGIN" >> "$RESULTS"
  exit 1
fi
echo ">> Logged in. User: $USER_ID"
echo "Login successful. User ID: $USER_ID" >> "$RESULTS"
echo "" >> "$RESULTS"

# ---- CHECK EXISTING DATA ----
echo ">> Checking existing data..."
echo "==============================================" >> "$RESULTS"
echo "EXISTING FINANCIAL DATA" >> "$RESULTS"
echo "==============================================" >> "$RESULTS"

BUDGETS=$($CURL -s "$BASE/finance/budgets" -H "Authorization: Bearer $TOKEN")
echo "--- Budgets ---" >> "$RESULTS"
echo "$BUDGETS" | $PYTHON -m json.tool >> "$RESULTS" 2>/dev/null || echo "$BUDGETS" >> "$RESULTS"
echo "" >> "$RESULTS"

GOALS=$($CURL -s "$BASE/finance/goals" -H "Authorization: Bearer $TOKEN")
echo "--- Goals ---" >> "$RESULTS"
echo "$GOALS" | $PYTHON -m json.tool >> "$RESULTS" 2>/dev/null || echo "$GOALS" >> "$RESULTS"
echo "" >> "$RESULTS"

# Extract a category name from budgets for GPS tests
BUDGET_CATEGORY=$($PYTHON -c "
import sys, json
d = json.loads('''$BUDGETS''')
budgets = d.get('data', [])
if budgets:
    print(budgets[0].get('category', {}).get('name', ''))
" 2>/dev/null)

BUDGET_CATEGORY_ID=$($PYTHON -c "
import sys, json
d = json.loads('''$BUDGETS''')
budgets = d.get('data', [])
if budgets:
    print(budgets[0].get('categoryId', '') or budgets[0].get('category', {}).get('id', ''))
" 2>/dev/null)

GOAL_ID=$($PYTHON -c "
import sys, json
d = json.loads('''$GOALS''')
goals = d.get('data', [])
if goals:
    print(goals[0].get('id', ''))
" 2>/dev/null)

echo "Budget category: '$BUDGET_CATEGORY' (ID: $BUDGET_CATEGORY_ID)" >> "$RESULTS"
echo "Goal ID: $GOAL_ID" >> "$RESULTS"
echo "" >> "$RESULTS"

if [ -z "$BUDGET_CATEGORY" ]; then
  BUDGET_CATEGORY="Food & Dining"
  echo ">> No budget found, using default category: $BUDGET_CATEGORY"
fi

echo "################################################" >> "$RESULTS"
echo "# GPS RE-ROUTER ENDPOINT TESTS" >> "$RESULTS"
echo "################################################" >> "$RESULTS"
echo "" >> "$RESULTS"

TEST_NUM=0
PASS_COUNT=0
ISSUE_COUNT=0
ISSUES_DETAIL=""
SESSION_ID=""

run_test() {
  local METHOD="$1"
  local ENDPOINT="$2"
  local LABEL="$3"
  local BODY="$4"
  local EXPECTED="$5"

  TEST_NUM=$((TEST_NUM + 1))
  echo ">> [$TEST_NUM] $LABEL"

  echo "=============================================" >> "$RESULTS"
  echo "TEST #$TEST_NUM: $LABEL" >> "$RESULTS"
  echo "$METHOD ${BASE}${ENDPOINT}" >> "$RESULTS"
  [ -n "$BODY" ] && echo "BODY: $BODY" >> "$RESULTS"
  [ -n "$EXPECTED" ] && echo "EXPECTED: HTTP $EXPECTED" >> "$RESULTS"
  echo "---------------------------------------------" >> "$RESULTS"

  local RESPONSE=""
  if [ "$METHOD" = "GET" ]; then
    RESPONSE=$($CURL -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${BASE}${ENDPOINT}" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
  else
    if [ -n "$BODY" ]; then
      RESPONSE=$($CURL -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE}${ENDPOINT}" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY")
    else
      RESPONSE=$($CURL -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE}${ENDPOINT}" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
    fi
  fi

  local HTTP_CODE=$(echo "$RESPONSE" | /usr/bin/tail -1 | /usr/bin/sed 's/HTTP_STATUS://')
  local RESP_BODY=$(echo "$RESPONSE" | /usr/bin/sed '$d')

  echo "HTTP Status: $HTTP_CODE" >> "$RESULTS"
  echo "Response:" >> "$RESULTS"
  echo "$RESP_BODY" | $PYTHON -m json.tool >> "$RESULTS" 2>/dev/null || echo "$RESP_BODY" >> "$RESULTS"

  local IS_PASS=false
  if [ -n "$EXPECTED" ]; then
    [ "$HTTP_CODE" = "$EXPECTED" ] && IS_PASS=true
  else
    ([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]) && IS_PASS=true
  fi

  if [ "$IS_PASS" = true ]; then
    if [ -n "$EXPECTED" ] && [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
      echo "RESULT: PASS (expected HTTP $EXPECTED)" >> "$RESULTS"
    else
      echo "RESULT: PASS" >> "$RESULTS"
    fi
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "RESULT: ISSUE (HTTP $HTTP_CODE)" >> "$RESULTS"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
    ISSUES_DETAIL="${ISSUES_DETAIL}\n  #$TEST_NUM: $LABEL => HTTP $HTTP_CODE"
  fi
  echo "" >> "$RESULTS"

  # Capture session ID
  if echo "$LABEL" | /usr/bin/grep -qi "recalculate"; then
    local SID=$(echo "$RESP_BODY" | $PYTHON -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('sessionId',''))" 2>/dev/null)
    if [ -n "$SID" ] && [ "$SID" != "" ] && [ "$SID" != "None" ]; then
      SESSION_ID="$SID"
      echo ">> Captured sessionId: $SESSION_ID"
      echo "CAPTURED SESSION_ID: $SESSION_ID" >> "$RESULTS"
    fi
  fi
}

run_noauth() {
  local ENDPOINT="$1"
  local LABEL="$2"
  TEST_NUM=$((TEST_NUM + 1))
  echo ">> [$TEST_NUM] $LABEL (NO AUTH)"

  echo "=============================================" >> "$RESULTS"
  echo "TEST #$TEST_NUM: $LABEL" >> "$RESULTS"
  echo "GET ${BASE}${ENDPOINT} (NO AUTH)" >> "$RESULTS"
  echo "EXPECTED: HTTP 401" >> "$RESULTS"
  echo "---------------------------------------------" >> "$RESULTS"

  local RESPONSE=$($CURL -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${BASE}${ENDPOINT}" \
    -H "Content-Type: application/json")
  local HTTP_CODE=$(echo "$RESPONSE" | /usr/bin/tail -1 | /usr/bin/sed 's/HTTP_STATUS://')
  local RESP_BODY=$(echo "$RESPONSE" | /usr/bin/sed '$d')

  echo "HTTP Status: $HTTP_CODE" >> "$RESULTS"
  echo "Response:" >> "$RESULTS"
  echo "$RESP_BODY" | $PYTHON -m json.tool >> "$RESULTS" 2>/dev/null || echo "$RESP_BODY" >> "$RESULTS"

  if [ "$HTTP_CODE" = "401" ]; then
    echo "RESULT: PASS (401 Unauthorized)" >> "$RESULTS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "RESULT: ISSUE (expected 401, got $HTTP_CODE)" >> "$RESULTS"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
    ISSUES_DETAIL="${ISSUES_DETAIL}\n  #$TEST_NUM: $LABEL => expected 401, got $HTTP_CODE"
  fi
  echo "" >> "$RESULTS"
}

# ============================================
# TEST EXECUTION
# ============================================

# -- 1. POST /gps/recalculate --
run_test "POST" "/gps/recalculate" \
  "1a. Recalculate (category name)" \
  "{\"category\":\"$BUDGET_CATEGORY\"}"

if [ -n "$GOAL_ID" ] && [ "$GOAL_ID" != "" ] && [ "$GOAL_ID" != "None" ]; then
  run_test "POST" "/gps/recalculate" \
    "1b. Recalculate (category + goalId)" \
    "{\"category\":\"$BUDGET_CATEGORY\",\"goalId\":\"$GOAL_ID\"}"
else
  run_test "POST" "/gps/recalculate" \
    "1b. Recalculate (category + goalId - no goal available)" \
    "{\"category\":\"$BUDGET_CATEGORY\"}"
fi

# Use captured session or fallback
if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "None" ]; then
  echo ">> No session captured from recalculate. Checking DB for existing sessions..."
  SESSION_ID=$(PGPASSWORD=password psql -h localhost -U postgres -d ikpa -tA -c \
    "SELECT id FROM gps_recovery_sessions WHERE \"userId\" = '$USER_ID' ORDER BY \"createdAt\" DESC LIMIT 1;" 2>/dev/null)
  SESSION_ID=$(echo "$SESSION_ID" | /usr/bin/tr -d '[:space:]')
  if [ -n "$SESSION_ID" ]; then
    echo ">> Found existing session: $SESSION_ID"
    echo "NOTE: Using existing session from DB: $SESSION_ID" >> "$RESULTS"
    echo "" >> "$RESULTS"
  else
    echo ">> No sessions found in DB"
  fi
fi

# -- 2. GET /gps/recovery-paths --
run_test "GET" "/gps/recovery-paths" \
  "2a. Get recovery paths (auto-detect)"

if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "" ]; then
  run_test "GET" "/gps/recovery-paths?sessionId=$SESSION_ID" \
    "2b. Get recovery paths (by sessionId)"
fi

# -- 3. POST /gps/recovery-paths/:pathId/select --
if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "" ]; then
  run_test "POST" "/gps/recovery-paths/time_adjustment/select" \
    "3a. Select path: time_adjustment" \
    "{\"sessionId\":\"$SESSION_ID\"}"

  # Try second path (may get 409 if already selected)
  run_test "POST" "/gps/recovery-paths/rate_adjustment/select" \
    "3b. Select path: rate_adjustment (may 409)" \
    "{\"sessionId\":\"$SESSION_ID\"}"

  run_test "POST" "/gps/recovery-paths/freeze_protocol/select" \
    "3c. Select path: freeze_protocol (may 409)" \
    "{\"sessionId\":\"$SESSION_ID\"}"
else
  echo ">> Skipping path selection (no session)"
  echo "SKIPPED: Tests 3a-3c (Select recovery path) - no session available" >> "$RESULTS"
  echo "" >> "$RESULTS"
fi

# Invalid path
run_test "POST" "/gps/recovery-paths/bogus_path/select" \
  "3d. Select INVALID path" \
  "{\"sessionId\":\"${SESSION_ID:-00000000-1111-2222-3333-444444444444}\"}" \
  "400"

# -- 4. POST /gps/what-if --
run_test "POST" "/gps/what-if" \
  "4a. What-If simulation" \
  "{\"category\":\"$BUDGET_CATEGORY\",\"additionalSpend\":5000}"

if [ -n "$GOAL_ID" ] && [ "$GOAL_ID" != "" ] && [ "$GOAL_ID" != "None" ]; then
  run_test "POST" "/gps/what-if" \
    "4b. What-If with goalId" \
    "{\"category\":\"$BUDGET_CATEGORY\",\"additionalSpend\":10000,\"goalId\":\"$GOAL_ID\"}"
fi

# -- 5. GET /gps/sessions/:sessionId --
if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "" ]; then
  run_test "GET" "/gps/sessions/$SESSION_ID" \
    "5a. Get session details (real session)"
fi

run_test "GET" "/gps/sessions/00000000-1111-2222-3333-444444444444" \
  "5b. Get session (non-existent)" \
  "" "404"

# -- 6. GET /gps/analytics/dashboard --
run_test "GET" "/gps/analytics/dashboard" \
  "6a. Analytics dashboard (default)"

run_test "GET" "/gps/analytics/dashboard?days=7" \
  "6b. Analytics dashboard (7 days)"

# -- 7. GET /gps/analytics/me --
run_test "GET" "/gps/analytics/me" \
  "7a. My analytics (default)"

run_test "GET" "/gps/analytics/me?days=30" \
  "7b. My analytics (30 days)"

# -- 8. GET /gps/analytics/categories --
run_test "GET" "/gps/analytics/categories" \
  "8. Category analytics"

# -- 9. GET /gps/streaks --
run_test "GET" "/gps/streaks" \
  "9. Streak status"

# -- 10. GET /gps/achievements --
run_test "GET" "/gps/achievements" \
  "10. Achievements"

# -- 11. GET /gps/notifications --
run_test "GET" "/gps/notifications" \
  "11a. Notifications (default)"

run_test "GET" "/gps/notifications?limit=5&unreadOnly=true" \
  "11b. Notifications (limit=5, unreadOnly)"

# -- 12. GET /gps/notifications/unread-count --
run_test "GET" "/gps/notifications/unread-count" \
  "12. Unread count"

# -- 13. POST /gps/notifications/:id/read --
# Get a real notification ID if available
NOTIF_ID=$($CURL -s "$BASE/gps/notifications" -H "Authorization: Bearer $TOKEN" | \
  $PYTHON -c "import sys,json; ns=json.load(sys.stdin).get('data',{}).get('notifications',[]); print(ns[0]['id'] if ns else '')" 2>/dev/null)

if [ -n "$NOTIF_ID" ] && [ "$NOTIF_ID" != "" ] && [ "$NOTIF_ID" != "None" ]; then
  run_test "POST" "/gps/notifications/$NOTIF_ID/read" \
    "13a. Mark notification read (real ID)"
fi

run_test "POST" "/gps/notifications/00000000-1111-2222-3333-444444444444/read" \
  "13b. Mark notification read (fake ID)"

# -- 14. POST /gps/notifications/read-all --
run_test "POST" "/gps/notifications/read-all" \
  "14. Mark all notifications read"

# -- 15. GET /gps/active-adjustments --
run_test "GET" "/gps/active-adjustments" \
  "15. Active adjustments"

# -- 16. GET /gps/active-adjustments/frozen/:categoryId --
run_test "GET" "/gps/active-adjustments/frozen/Food%20%26%20Dining" \
  "16a. Frozen check (Food & Dining)"

if [ -n "$BUDGET_CATEGORY_ID" ] && [ "$BUDGET_CATEGORY_ID" != "" ] && [ "$BUDGET_CATEGORY_ID" != "None" ]; then
  ENCODED_CAT=$(echo "$BUDGET_CATEGORY_ID" | /usr/bin/sed 's/ /%20/g; s/&/%26/g')
  run_test "GET" "/gps/active-adjustments/frozen/$ENCODED_CAT" \
    "16b. Frozen check (category ID: $BUDGET_CATEGORY_ID)"
fi

run_test "GET" "/gps/active-adjustments/frozen/Foood" \
  "16c. Frozen check (typo - fuzzy match)"

run_test "GET" "/gps/active-adjustments/frozen/Transport" \
  "16d. Frozen check (Transport)"

# -- Auth Guard Tests --
run_noauth "/gps/streaks" "Auth guard: GET /gps/streaks"
run_noauth "/gps/achievements" "Auth guard: GET /gps/achievements"
run_noauth "/gps/notifications" "Auth guard: GET /gps/notifications"

# ============================================
# SUMMARY
# ============================================
echo "" >> "$RESULTS"
echo "################################################" >> "$RESULTS"
echo "# TEST SUMMARY" >> "$RESULTS"
echo "################################################" >> "$RESULTS"
echo "" >> "$RESULTS"
echo "Total Tests:  $TEST_NUM" >> "$RESULTS"
echo "Passed:       $PASS_COUNT" >> "$RESULTS"
echo "Issues:       $ISSUE_COUNT" >> "$RESULTS"
echo "" >> "$RESULTS"

if [ "$ISSUE_COUNT" -gt 0 ]; then
  echo "--- ISSUES ---" >> "$RESULTS"
  echo -e "$ISSUES_DETAIL" >> "$RESULTS"
  echo "" >> "$RESULTS"
fi

echo "=============================================" >> "$RESULTS"
echo "END OF TEST RESULTS" >> "$RESULTS"
echo "=============================================" >> "$RESULTS"

echo ""
echo "============================="
echo "Done! Total: $TEST_NUM | Pass: $PASS_COUNT | Issues: $ISSUE_COUNT"
echo "Results: $RESULTS"
echo "============================="
