#!/bin/bash
# Department / Employee / Profile / Location / Training / LeaveRequest: CRUD, relationships,
# duplicates (409), missing records (404), bad input (400) and the safe-delete rules.
# Needs: curl, jq, a running API (API_BASE, default http://localhost:8082) and ADMIN_PASSWORD. Removes what it creates.
B="${API_BASE:-http://localhost:8082}"
J='Content-Type: application/json'
. "$(dirname "$0")/auth.sh"   # signs in as the administrator: sets $TOKEN and $AUTH
PASS=0; FAIL=0
# req METHOD PATH [BODY] -> sets CODE and BODY
req() { local m=$1 p=$2 d=$3
  if [ -n "$d" ]; then R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$J" -H "$AUTH" -d "$d" "$B$p"); else R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$AUTH" "$B$p"); fi
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); }
expect() { # name expectedcode
  if [ "$CODE" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($CODE)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected $2 got $CODE :: $BODY" | cut -c1-300; fi; }
id() { echo "$BODY" | jq -r '.id'; }
T=ZZ$(date +%s); NID=$(printf "%016d" $(date +%s)); ph() { printf "+25078%07d" $(( (RANDOM*32768+RANDOM) % 10000000 )); }; C=P$(date +%s | tail -c 7)

echo "--- DEPARTMENT"
req POST /department/create "{\"name\":\"$T-Dept\",\"code\":\"$T-D\",\"description\":\"d\"}"; expect "create dept" 200; D1=$(id)
req POST /department/create "{\"name\":\"$T-Dept\",\"code\":\"$T-X\"}"; expect "dup dept name -> 409" 409
req POST /department/create "{\"name\":\"$T-Other\",\"code\":\"$T-D\"}"; expect "dup dept code -> 409" 409
req PUT /department/$D1 "{\"name\":\"$T-Dept\",\"code\":\"$T-D\",\"description\":\"changed\"}"; expect "update dept same name (no false conflict)" 200
echo "   description=$(echo $BODY | jq -r .description)"
req GET /department/search/$D1; expect "get dept by id" 200
req GET /department/search/00000000-0000-0000-0000-000000000000; expect "get dept unknown -> 404" 404
req GET /department/search-all; expect "list depts" 200

echo "--- PROFILE"
req POST /employee-profile/create "{\"nationalId\":\"$NID\",\"dateOfBirth\":\"1995-05-05\",\"educationLevel\":\"Bachelor\"}"; expect "create profile" 200; P1=$(id)
req POST /employee-profile/create "{\"nationalId\":\"$NID\",\"dateOfBirth\":\"1995-05-05\",\"educationLevel\":\"Bachelor\"}"; expect "dup national id -> 409" 409
req PUT /employee-profile/$P1 "{\"nationalId\":\"$NID\",\"dateOfBirth\":\"1995-05-05\",\"educationLevel\":\"Master\"}"; expect "update profile" 200
req GET /employee-profile/search/$P1; expect "get profile by id (typo fix)" 200

echo "--- LOCATION"
req POST /location/create "{\"name\":\"$T-Prov\",\"type\":\"PROVINCE\",\"code\":\"$C\"}"; expect "create province" 200; L1=$(id)
req POST /location/create "{\"name\":\"$T-Prov2\",\"type\":\"PROVINCE\",\"code\":\"$C\"}"; expect "dup province code -> 409" 409
req POST /location/create "{\"name\":\"$T-Dist\",\"type\":\"DISTRICT\",\"parent\":{\"id\":\"$L1\"}}"; expect "create district" 200; L2=$(id)
req POST /location/create "{\"name\":\"$T-Cell\",\"type\":\"CELL\",\"parent\":{\"id\":\"$L2\"}}"; expect "cell under district (skips sector) -> 400" 400
req POST /location/create "{\"name\":\"$T-Sec\",\"type\":\"SECTOR\"}"; expect "sector without parent -> 400" 400
req POST /location/create "{\"name\":\"$T-Sec\",\"type\":\"SECTOR\",\"parent\":{\"id\":\"$L2\"}}"; expect "create sector" 200; L3=$(id)
req POST /location/create "{\"name\":\"$T-Cell\",\"type\":\"CELL\",\"parent\":{\"id\":\"$L3\"}}"; expect "create cell" 200; L4=$(id)
req POST /location/create "{\"name\":\"$T-Vil\",\"type\":\"VILLAGE\",\"parent\":{\"id\":\"$L4\"}}"; expect "create village" 200; L5=$(id)
req GET /location/$L1/children; expect "children of province" 200; echo "   children=$(echo $BODY | jq length)"
req GET /location/type/PROVINCE; expect "provinces by type" 200
req GET /location/search/$L5; expect "get village" 200; echo "   parent chain: $(echo $BODY | jq -r '.parent.parent.parent.parent.name')"
req POST /location/create '{"name":"x","type":"NOPE"}'; expect "bad enum -> 400" 400

echo "--- EMPLOYEE"
PH1=$(ph); PH3=$(ph); PH4=$(ph)
E="{\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"$T@x.com\",\"phone\":\"$PH1\",\"gender\":\"FEMALE\",\"hireDate\":\"2024-01-15\",\"status\":\"ACTIVE\",\"department\":{\"id\":\"$D1\"},\"location\":{\"id\":\"$L5\"},\"profile\":{\"id\":\"$P1\"}}"
req POST /employee/create "$E"; expect "create employee with dept+location+profile" 200; E1=$(id)
echo "   dept=$(echo $BODY | jq -r .department.name) loc=$(echo $BODY | jq -r .location.name) profile=$(echo $BODY | jq -r .profile.educationLevel)"
req POST /employee/create "$E"; expect "dup email -> 409" 409
E2=$(echo "$E" | jq -c ".email=\"$T-2@x.com\"" )
req POST /employee/create "$E2"; expect "same phone -> 409" 409
E3=$(echo "$E" | jq -c ".email=\"$T-3@x.com\" | .phone=\"$PH3\"")
req POST /employee/create "$E3"; expect "profile already linked -> 409" 409
E4=$(echo "$E" | jq -c ".email=\"$T-4@x.com\" | .phone=\"$PH4\" | .profile=null | .department={\"id\":\"00000000-0000-0000-0000-000000000000\"}")
req POST /employee/create "$E4"; expect "unknown department -> 404" 404
req GET /employee/search/$E1; expect "get employee by id (typo fix)" 200
req GET /employee/search-all; expect "list employees" 200; echo "   count>=1: $(echo $BODY | jq 'length>=1')"
req PUT /employee/$E1 "$(echo "$E" | jq -c '.firstName="Changed" | del(.profile)')"; expect "update employee without profile" 200
echo "   firstName=$(echo $BODY | jq -r .firstName) profile-kept=$(echo $BODY | jq -r '.profile.id!=null')"
req GET /department/$D1/employees; echo "   (no such route, code $CODE)"

echo "--- TRAINING"
req POST /training/create "{\"title\":\"$T-Train\",\"trainer\":\"Dr X\",\"startDate\":\"2026-04-01\",\"endDate\":\"2026-04-05\"}"; expect "create training" 200; TR1=$(id)
req POST /training/create "{\"title\":\"$T-Train\"}"; expect "dup title -> 409" 409
req POST /training/create "{\"title\":\"$T-Bad\",\"startDate\":\"2026-04-05\",\"endDate\":\"2026-04-01\"}"; expect "end before start -> 400" 400
req POST /training/$TR1/assign/$E1; expect "assign employee" 200
req POST /training/$TR1/assign/$E1; expect "assign twice -> 409" 409
req GET /training/employee/$E1; expect "trainings of employee" 200; echo "   n=$(echo $BODY | jq length)"
req GET /training/$TR1/employees; expect "employees of training" 200; echo "   n=$(echo $BODY | jq length)"
req GET "/training/search?title=$(echo $T | tr A-Z a-z)"; expect "search by title (case-insens)" 200; echo "   n=$(echo $BODY | jq length)"
req DELETE /training/$TR1/remove/$E1; expect "remove employee" 200
req DELETE /training/$TR1/remove/$E1; expect "remove not enrolled -> 404" 404
req POST /training/$TR1/assign/$E1; expect "re-assign" 200

echo "--- LEAVE"
req POST /leave/create "{\"startDate\":\"2026-03-01\",\"endDate\":\"2026-03-05\",\"type\":\"ANNUAL\",\"reason\":\"trip\",\"status\":\"APPROVED\",\"employee\":{\"id\":\"$E1\"}}"; expect "create leave (client status ignored)" 200; LV1=$(id)
echo "   status=$(echo $BODY | jq -r .status)"
req POST /leave/create "{\"startDate\":\"2026-03-05\",\"endDate\":\"2026-03-01\",\"type\":\"SICK\",\"employee\":{\"id\":\"$E1\"}}"; expect "end before start -> 400" 400
req POST /leave/create "{\"startDate\":\"2026-03-01\",\"endDate\":\"2026-03-05\",\"type\":\"SICK\"}"; expect "no employee -> 400" 400
req PUT /leave/$LV1 "{\"startDate\":\"2026-03-02\",\"endDate\":\"2026-03-06\",\"type\":\"ANNUAL\",\"reason\":\"edited\"}"; expect "edit pending" 200
req GET /leave/employee/$E1; expect "leaves of employee" 200; echo "   n=$(echo $BODY | jq length)"
req GET /leave/status/PENDING; expect "by status" 200
req GET /leave/type/ANNUAL; expect "by type" 200
req PATCH /leave/$LV1/approve; expect "approve" 200; echo "   status=$(echo $BODY | jq -r .status)"
req PATCH /leave/$LV1/reject '{"reason":"Not enough cover that week"}'; expect "reject after approve -> 409" 409
req PUT /leave/$LV1 "{\"startDate\":\"2026-03-02\",\"endDate\":\"2026-03-06\",\"type\":\"ANNUAL\"}"; expect "edit decided -> 409" 409
req POST /leave/create "{\"startDate\":\"2026-05-01\",\"endDate\":\"2026-05-02\",\"type\":\"UNPAID\",\"employee\":{\"id\":\"$E1\"}}"; LV2=$(id)
req PATCH /leave/$LV2/reject; expect "reject without a body -> 400" 400
req PATCH /leave/$LV2/reject '{"reason":"   "}'; expect "reject with a blank reason -> 400" 400
req GET /leave/search/$LV2; expect "still pending after refused rejections" 200; echo "   status=$(echo $BODY | jq -r .status)"
req PATCH /leave/$LV2/reject '{"reason":"Not enough cover that week"}'; expect "reject pending with a reason" 200; echo "   rejectionReason=$(echo $BODY | jq -r .rejectionReason)"

echo "--- SAFE DELETES"
req DELETE /location/$L1; expect "delete province (subtree + employee.location nulled)" 204
req GET /location/search/$L5; expect "village gone -> 404" 404
req GET /employee/search/$E1; expect "employee survived" 200; echo "   location=$(echo $BODY | jq -r .location)"
req DELETE /department/$D1; expect "delete dept with employees" 204
req GET /employee/search/$E1; expect "employee survived dept delete" 200; echo "   department=$(echo $BODY | jq -r .department)"
req DELETE /employee-profile/$P1; expect "delete profile linked to employee" 204
req GET /employee/search/$E1; echo "   profile=$(echo $BODY | jq -r .profile)"
req DELETE /training/$TR1; expect "delete training with enrolled employee" 204
req DELETE /employee/$E1; expect "delete employee (leaves + join rows)" 204
req GET /leave/search/$LV1; expect "leave gone with employee -> 404" 404
req DELETE /employee/$E1; expect "delete again -> 404" 404

echo; echo "RESULT: $PASS passed, $FAIL failed"
