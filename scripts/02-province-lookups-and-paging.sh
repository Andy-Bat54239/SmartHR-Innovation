#!/bin/bash
# Employees by province (id / code / name), employee -> province and location path,
# pagination + sorting (and their 400s) and the status / gender filters.
# Needs: curl, jq, a running API (API_BASE, default http://localhost:8082) and ADMIN_PASSWORD. Removes what it creates.
B="${API_BASE:-http://localhost:8082}"
J='Content-Type: application/json'
. "$(dirname "$0")/auth.sh"   # signs in as the administrator: sets $TOKEN and $AUTH
PASS=0; FAIL=0
req() { local m=$1 p=$2 d=$3
  if [ -n "$d" ]; then R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$J" -H "$AUTH" -d "$d" "$B$p"); else R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$AUTH" "$B$p"); fi
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); }
expect() { if [ "$CODE" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($CODE)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected $2 got $CODE :: $BODY" | cut -c1-300; fi; }
check() { # name actual expected
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 (= $3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected '$3' got '$2'"; fi; }
id() { echo "$BODY" | jq -r '.id'; }
T=ZZ$(date +%s); N=$(date +%s | tail -c 6)

mkloc() { req POST /location/create "{\"name\":\"$1\",\"type\":\"$2\",\"code\":$4,\"parent\":{\"id\":\"$3\"}}"; id; }
chain() { # prefix -> sets V (village id), DI (district id)
  DI=$(mkloc "$1-Dist" DISTRICT "$PV" null); SE=$(mkloc "$1-Sec" SECTOR "$DI" null); CE=$(mkloc "$1-Cell" CELL "$SE" null); V=$(mkloc "$1-Vil" VILLAGE "$CE" null); }
emp() { # idx lastName gender status location dept -> creates, prints id (idx is explicit: $(...) is a subshell)
  local i=$1; shift; local loc=$4; [ "$loc" != "null" ] && loc="{\"id\":\"$4\"}"
  req POST /employee/create "{\"firstName\":\"F$i\",\"lastName\":\"$1\",\"email\":\"$T-$i@x.com\",\"phone\":\"+25078${N}0$i\",\"gender\":\"$2\",\"status\":\"$3\",\"hireDate\":\"2024-01-0$i\",\"location\":$loc,\"department\":{\"id\":\"$5\"}}"
  [ "$CODE" = 200 ] || echo "   !! emp create failed $CODE $BODY" >&2; id; }

echo "--- SETUP: 2 provinces, employees spread at different levels"
req POST /department/create "{\"name\":\"$T-Dept\",\"code\":\"$T-D\"}"; D=$(id)
req POST /location/create "{\"name\":\"$T-North\",\"type\":\"PROVINCE\",\"code\":\"N$N\"}"; PA=$(id)
req POST /location/create "{\"name\":\"$T-South\",\"type\":\"PROVINCE\",\"code\":\"S$N\"}"; PB=$(id)
PV=$PA; chain "$T-A"; A_DIST=$DI; A_VIL=$V
PV=$PB; chain "$T-B"; B_VIL=$V
E1=$(emp 1 Delta   MALE   ACTIVE   $A_VIL  $D)
E2=$(emp 2 Alpha   FEMALE ACTIVE   $A_VIL  $D)
E3=$(emp 3 Charlie MALE   INACTIVE $A_DIST $D)   # attached at district level, still inside province A
E4=$(emp 4 Bravo   OTHER  ACTIVE   $B_VIL  $D)
E5=$(emp 5 Echo    FEMALE INACTIVE $B_VIL  $D)
E6=$(emp 6 Foxtrot MALE   ACTIVE   null    $D)   # no location
echo "   created: $E1 $E2 $E3 $E4 $E5 $E6" | cut -c1-80

echo "--- PROVINCE LOOKUPS"
req GET /employee/province/$PA; expect "by province id" 200; check "  province A count (village+district level)" "$(echo $BODY | jq length)" 3
req GET /employee/province/code/N$N; expect "by province code" 200; check "  count" "$(echo $BODY | jq length)" 3
req GET "/employee/province/name/$(echo $T | tr A-Z a-z)-north"; expect "by province name (case-insensitive)" 200; check "  count" "$(echo $BODY | jq length)" 3
req GET /employee/province/code/S$N; check "  province B count" "$(echo $BODY | jq length)" 2
req GET /employee/province/code/NOPE123; expect "unknown code -> 404" 404
req GET /employee/province/name/Atlantis; expect "unknown name -> 404" 404
req GET /employee/province/$A_DIST; expect "district id is not a province -> 400" 400
req GET /employee/province/00000000-0000-0000-0000-000000000000; expect "unknown id -> 404" 404

echo "--- EMPLOYEE -> PROVINCE / PATH"
req GET /employee/$E1/province; expect "province of employee" 200; check "  name" "$(echo $BODY | jq -r .name)" "$T-North"
req GET /employee/$E4/province; check "  other employee -> South" "$(echo $BODY | jq -r .name)" "$T-South"
req GET /employee/$E1/location; expect "location path" 200
check "  path length" "$(echo $BODY | jq length)" 5
check "  path order" "$(echo $BODY | jq -r '[.[].type]|join(">")')" "PROVINCE>DISTRICT>SECTOR>CELL>VILLAGE"
req GET /employee/$E3/location; check "  district-level employee path length" "$(echo $BODY | jq length)" 2
req GET /employee/$E6/location; expect "employee without location -> 404" 404
req GET /employee/$E6/province; expect "province of employee without location -> 404" 404

echo "--- PAGINATION (scoped to my department so other data cannot interfere)"
req GET "/employee/department/$D?size=4"; expect "page 0 size 4" 200
check "  keys" "$(echo $BODY | jq -c 'keys')" '["content","page"]'
check "  page keys" "$(echo $BODY | jq -c '.page|keys')" '["number","size","totalElements","totalPages"]'
check "  content size" "$(echo $BODY | jq '.content|length')" 4
check "  totalElements" "$(echo $BODY | jq '.page.totalElements')" 6
check "  totalPages" "$(echo $BODY | jq '.page.totalPages')" 2
req GET "/employee/department/$D?size=4&page=1"; check "  page 1 has the remaining 2" "$(echo $BODY | jq '.content|length')" 2
req GET "/employee/department/$D?size=10&page=5"; expect "page beyond the end -> 200" 200; check "  empty content" "$(echo $BODY | jq '.content|length')" 0
req GET "/employee/department/$D?sortBy=lastName&direction=asc&size=10"; check "  sort lastName asc" "$(echo $BODY | jq -r '[.content[].lastName]|join(",")')" "Alpha,Bravo,Charlie,Delta,Echo,Foxtrot"
req GET "/employee/department/$D?sortBy=lastName&direction=desc&size=10"; check "  sort lastName desc" "$(echo $BODY | jq -r '[.content[].lastName]|join(",")')" "Foxtrot,Echo,Delta,Charlie,Bravo,Alpha"
req GET "/employee/department/$D?sortBy=hireDate&direction=desc&size=2"; check "  sort hireDate desc top" "$(echo $BODY | jq -r '[.content[].lastName]|join(",")')" "Foxtrot,Echo"
req GET "/employee/department/$D?sortBy=password"; expect "sort by non-whitelisted field -> 400" 400
req GET "/employee/department/$D?direction=up"; expect "bad direction -> 400" 400
req GET "/employee/department/$D?size=0"; expect "size 0 -> 400" 400
req GET "/employee/department/$D?size=101"; expect "size over max -> 400" 400
req GET "/employee/department/$D?page=-1"; expect "negative page -> 400" 400
req GET "/employee/department/$D?page=abc"; expect "non numeric page -> 400" 400
req GET /employee/department/00000000-0000-0000-0000-000000000000; expect "unknown department -> 404" 404
req GET "/employee/search-page?size=2&sortBy=email"; expect "global search-page" 200; check "  size honoured" "$(echo $BODY | jq '.content|length')" 2
req GET /employee/search-all; check "  search-all is still a plain array" "$(echo $BODY | jq type -r)" "array"

echo "--- FILTERS"
req GET /employee/status/INACTIVE; expect "by status" 200; check "  inactive count" "$(echo $BODY | jq '[.[]|select(.department.id=="'$D'")]|length')" 2
req GET /employee/gender/OTHER; expect "by gender" 200; check "  OTHER count" "$(echo $BODY | jq '[.[]|select(.department.id=="'$D'")]|length')" 1
req GET /employee/gender/ROBOT; expect "bad gender -> 400" 400

echo "--- LEAVE PAGINATION"
for t in ANNUAL SICK UNPAID ANNUAL; do
  d=$((d+1)); req POST /leave/create "{\"startDate\":\"2026-0$((d+1))-01\",\"endDate\":\"2026-0$((d+1))-03\",\"type\":\"$t\",\"employee\":{\"id\":\"$E1\"}}"; done
req GET "/leave/employee/$E1/page?size=3&sortBy=startDate&direction=desc"; expect "employee leave page" 200
check "  total" "$(echo $BODY | jq '.page.totalElements')" 4; check "  page size" "$(echo $BODY | jq '.content|length')" 3
check "  newest first" "$(echo $BODY | jq -r '.content[0].startDate')" "2026-05-01"
req GET "/leave/search-page?size=2&sortBy=type"; expect "global leave page" 200; check "  content size" "$(echo $BODY | jq '.content|length')" 2
req GET "/leave/search-page?sortBy=reason"; expect "leave bad sort field -> 400" 400
req GET /leave/employee/00000000-0000-0000-0000-000000000000/page; expect "leave page unknown employee -> 404" 404

echo "--- SEARCH FILTERS on search-page (combined with AND; scoped to my department)"
F="/employee/search-page?departmentId=$D&size=10&sortBy=lastName&direction=asc"
names() { echo "$BODY" | jq -r '[.content[].lastName]|join(",")'; }
req GET "$F&q=alp"; expect "q matches part of a last name" 200; check "  result" "$(names)" "Alpha"
req GET "$F&q=F1%20DELTA"; check "  q matches the full name, ignoring case" "$(names)" "Delta"
req GET "$F&q=$T-3"; check "  q matches an email" "$(names)" "Charlie"
req GET "$F&q=${N}02"; check "  q matches a phone number" "$(names)" "Alpha"
req GET "$F&q=%25"; check "  q with a % sign is literal, not a wildcard" "$(echo $BODY | jq '.content|length')" 0
req GET "$F&q=%20%20"; check "  blank q is ignored" "$(echo $BODY | jq '.page.totalElements')" 6
req GET "$F&status=INACTIVE"; check "  status" "$(names)" "Charlie,Echo"
req GET "$F&gender=FEMALE"; check "  gender" "$(names)" "Alpha,Echo"
req GET "$F&status=INACTIVE&gender=FEMALE"; check "  status AND gender" "$(names)" "Echo"
req GET "$F&provinceId=$PA"; expect "province filter" 200; check "  province A (village + district level)" "$(names)" "Alpha,Charlie,Delta"
req GET "$F&provinceId=$PB"; check "  province B" "$(names)" "Bravo,Echo"
req GET "$F&provinceId=$PA&status=ACTIVE"; check "  province AND status" "$(names)" "Alpha,Delta"
req GET "$F&provinceId=$PA&gender=MALE&status=INACTIVE"; check "  province AND gender AND status" "$(names)" "Charlie"
req GET "/employee/search-page?departmentId=$D&status=ACTIVE&sortBy=lastName&direction=desc&size=2"; check "  filtered + sorted + paged: page 0" "$(names)" "Foxtrot,Delta"
check "  totalElements counts the filtered rows" "$(echo $BODY | jq '.page.totalElements')" 4
req GET "/employee/search-page?departmentId=$D&status=ACTIVE&sortBy=lastName&direction=desc&size=2&page=1"; check "  filtered + sorted + paged: page 1" "$(names)" "Bravo,Alpha"
req GET "$F&provinceId=$A_DIST"; expect "a district is not a province -> 400" 400
req GET "$F&provinceId=00000000-0000-0000-0000-000000000000"; expect "unknown province -> 404" 404
req GET "/employee/search-page?departmentId=00000000-0000-0000-0000-000000000000"; expect "unknown department -> 404" 404
req GET "$F&status=RETIRED"; expect "bad status value -> 400" 400
req GET "$F&gender=ROBOT"; expect "bad gender value -> 400" 400
req GET "/employee/search-page?provinceId=not-a-uuid"; expect "malformed province id -> 400" 400

echo "--- LEAVE FILTERS on search-page (status / type / employee, combined with AND)"
req GET /leave/employee/$E1; LV_SICK=$(echo $BODY | jq -r '[.[]|select(.type=="SICK")][0].id')
req PATCH /leave/$LV_SICK/approve; expect "approve one request (SICK) so the statuses differ" 200
LF="/leave/search-page?employeeId=$E1&size=10&sortBy=startDate&direction=asc"
total() { echo "$BODY" | jq '.page.totalElements'; }
req GET "$LF"; expect "employee filter" 200; check "  all of E1's requests" "$(total)" 4
req GET "$LF&status=APPROVED"; check "  status APPROVED" "$(total)" 1
req GET "$LF&status=PENDING"; check "  status PENDING" "$(total)" 3
req GET "$LF&status=REJECTED"; check "  status REJECTED" "$(total)" 0
req GET "$LF&type=ANNUAL"; check "  type ANNUAL" "$(total)" 2
req GET "$LF&type=ANNUAL&status=PENDING"; check "  type AND status" "$(total)" 2
req GET "$LF&type=SICK&status=PENDING"; check "  type AND status with no match" "$(total)" 0
req GET "$LF&type=SICK&status=APPROVED"; check "  the approved SICK request" "$(echo $BODY | jq -r '.content[0].type')" "SICK"
check "  each row carries its employee" "$(echo $BODY | jq -r '.content[0].employee.lastName')" "Delta"
req GET "/leave/search-page?employeeId=$E1&status=PENDING&sortBy=startDate&direction=desc&size=2"; check "  filtered + sorted + paged" "$(echo $BODY | jq -r '[.content[].startDate]|join(",")')" "2026-05-01,2026-04-01"
check "  totalElements counts filtered rows" "$(total)" 3
req GET "/leave/search-page?status=APPROVED&size=50"; check "  no employee filter: approved across everyone" "$(echo $BODY | jq '[.content[]|select(.employee.id=="'$E1'")]|length')" 1
req GET "/leave/search-page?employeeId=00000000-0000-0000-0000-000000000000"; expect "unknown employee -> 404" 404
req GET "$LF&status=MAYBE"; expect "bad status -> 400" 400
req GET "$LF&type=HOLIDAY"; expect "bad type -> 400" 400
req GET "/leave/search-page?employeeId=not-a-uuid"; expect "malformed employee id -> 400" 400

echo "--- CLEANUP"
for e in $E1 $E2 $E3 $E4 $E5 $E6; do req DELETE /employee/$e; done
req DELETE /location/$PA; expect "delete province A" 204
req DELETE /location/$PB; expect "delete province B" 204
req DELETE /department/$D; expect "delete department" 204

echo; echo "RESULT: $PASS passed, $FAIL failed"
