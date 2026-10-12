#!/bin/bash
# The audit trail (GET /audit/search-page, administrators only): every kind of event is recorded with who / what /
# when / from where and the before->after values; nothing is recorded for a change that failed or changed nothing;
# sensitive values (national ID, date of birth, passwords) never appear anywhere in it; entries outlive the
# accounts and records they describe; the endpoint is read-only; and the filters work.
# Creates its own test accounts (random passwords) and removes them; the audit entries it causes stay, by design.
# Needs: curl, jq, a running API (API_BASE, default http://localhost:8082) and ADMIN_PASSWORD.
B="${API_BASE:-http://localhost:8082}"
J='Content-Type: application/json'
. "$(dirname "$0")/auth.sh"   # signs in as the administrator: sets $TOKEN and $AUTH
ADMIN_TOKEN="$TOKEN"; HDR=$(mktemp); trap 'rm -f "$HDR"' EXIT
PASS=0; FAIL=0

rq() { local tok=$1 m=$2 p=$3 d=$4; local args=(-s -m 10 -D "$HDR" -w "\n%{http_code}" -X "$m")
  [ -n "$tok" ] && args+=(-H "Authorization: Bearer $tok"); [ -n "$d" ] && args+=(-H "$J" -d "$d")
  R=$(curl "${args[@]}" "$B$p"); CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); }
expect() { if [ "$CODE" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($CODE)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected $2 got $CODE :: $BODY" | cut -c1-260; fi; }
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 (= $3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected '$3' got '$2'"; fi; }
has() { if echo "$2" | grep -qF -- "$3"; then PASS=$((PASS+1)); echo "PASS  $1"; else FAIL=$((FAIL+1)); echo "FAIL  $1: expected to contain '$3' but got '$2'" | cut -c1-260; fi; }
json() { jq -nc "$@"; }
id() { echo "$BODY" | jq -r '.id'; }
genpw() { printf 'Pw%s9x' "$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 12)"; }
T=zz$(date +%s); TU=$(echo $T | tr a-z A-Z); N=$(date +%s | tail -c 6)
shift_days() { date -v"$1"d +%F 2>/dev/null || date -d "$1 days" +%F; }
TODAY=$(date +%F); TOMORROW=$(shift_days +1); YESTERDAY=$(shift_days -1); NEXT_WEEK=$(shift_days +7)

# audit QUERY: the events matching the query string, as the administrator; sets EV (the body)
audit() { local q="$1"; case "$q" in *size=*) ;; *) q="size=100&$q";; esac; rq "$ADMIN_TOKEN" GET "/audit/search-page?$q"; EV="$BODY"; }
total() { echo "$EV" | jq '.page.totalElements'; }
# ev FILTER: the newest event matching the jq filter, e.g. ev '.action=="CREATED"'
ev() { echo "$EV" | jq -c "[.content[]|select($1)][0]"; }
f() { echo "$1" | jq -r "$2"; }   # field of an event

# as-ACCOUNT helpers
mkuser() { rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$1" --arg r "$2" --arg e "$3" '{username:$u,role:$r,employeeId:(if $e=="" then null else $e end)}')"; NEW_ID=$(echo "$BODY" | jq -r '.user.id'); NEW_TEMP=$(echo "$BODY" | jq -r '.temporaryPassword'); }
activate() { local pw; pw=$(genpw)
  rq "" POST /auth/login "$(json --arg u "$1" --arg p "$2" '{username:$u,password:$p}')"; local first; first=$(echo "$BODY" | jq -r '.token')
  rq "$first" POST /auth/change-password "$(json --arg c "$2" --arg n "$pw" '{currentPassword:$c,newPassword:$n}')"
  ACTIVATED=$(echo "$BODY" | jq -r '.token'); ACTIVATED_PW=$pw; }
emp() { rq "$ADMIN_TOKEN" POST /employee/create "$(json --arg e "$T-$1@x.com" --arg ph "+25078${N}0$1" --arg f "$2" --arg d "$3" '{firstName:$f,lastName:"Audit'"$TU"'",email:$e,phone:$ph,gender:"FEMALE",status:"ACTIVE",hireDate:"2024-01-01",department:(if $d=="" then null else {id:$d} end)}')"; echo "$BODY" | jq -r '.id'; }

echo "--- SET UP: two accounts to act as"
HR_NAME="$T-hr@audit.example"; EMP_NAME="$T-emp@audit.example"
EMP_E=$(emp 1 Esther ""); EMP_HR=$(emp 2 Hanna "")
mkuser "$HR_NAME" HR $EMP_HR; HR_ID=$NEW_ID; HR_TEMP=$NEW_TEMP
mkuser "$EMP_NAME" EMPLOYEE $EMP_E; EMP_ID=$NEW_ID; EMP_TEMP=$NEW_TEMP
audit "q=$T"; expect "the trail answers" 200
check "  it is paged, with the usual shape" "$(echo "$EV" | jq -c 'keys')" '["content","page"]'
check "  two accounts were created: each is an entry, by the administrator" "$(echo "$EV" | jq "[.content[]|select(.action==\"ACCOUNT_CREATED\")]|length")" 2
E=$(ev '.action=="ACCOUNT_CREATED" and .entityLabel=="'$HR_NAME'"')
check "  who: the administrator" "$(f "$E" .actorUsername)" "$ADMIN_USER"; check "  their role" "$(f "$E" .actorRole)" "ADMIN"
check "  what: an account" "$(f "$E" .entityType)" "ACCOUNT"; check "  the id of the account" "$(f "$E" .entityId)" "$HR_ID"
check "  a sentence" "$(f "$E" .summary)" "Created account $HR_NAME"
check "  from where (an address was recorded)" "$([ -n "$(f "$E" .ipAddress)" ] && [ "$(f "$E" .ipAddress)" != null ] && echo yes)" yes
check "  when (an ISO timestamp, close to now)" "$(f "$E" '(.occurredAt | sub("\\.[0-9]+Z$";"Z") | fromdateiso8601) > (now - 120)')" true
check "  what the account started with (role, status, employee)" "$(echo "$E" | jq -c '[.changes[]|{f:.field,n:.newValue}]|sort_by(.f)')" '[{"f":"Employee","n":"Hanna Audit'"$TU"'"},{"f":"Role","n":"Hr"},{"f":"Status","n":"Active"},{"f":"Username","n":"'$HR_NAME'"}]'
check "  and nothing about a password" "$(echo "$EV" | grep -ci 'password\|hash\|\$2a\$' )" 0
check "  the temporary password itself is nowhere in the trail" "$(echo "$EV" | grep -cF "$HR_TEMP")" 0

echo "--- SIGNING IN"
rq "" POST /auth/login "$(json --arg u "$HR_NAME" --arg p "$HR_TEMP" '{username:$u,password:$p}')"; expect "sign in with the temporary password" 200; FIRST=$(echo "$BODY" | jq -r .token)
audit "q=$T&action=SIGNED_IN"; E=$(ev '.actorUsername=="'$HR_NAME'"')
check "  recorded as SIGNED_IN, by that account" "$(f "$E" .action)" "SIGNED_IN"; check "  with their role" "$(f "$E" .actorRole)" "HR"
rq "" POST /auth/login "$(json --arg u "$HR_NAME" '{username:$u,password:"not-the-password"}')"; expect "a wrong password" 401
audit "q=$T&action=SIGN_IN_FAILED"; E=$(ev '.actorUsername=="'$HR_NAME'"')
check "  recorded as SIGN_IN_FAILED, naming the username that was tried" "$(f "$E" .entityLabel)" "$HR_NAME"; check "  the reason is kept for the administrator" "$(f "$E" .note)" "Wrong password"
check "  the wrong password itself is not kept" "$(echo "$EV" | grep -c 'not-the-password')" 0
rq "" POST /auth/login "$(json --arg u "ghost-$T@audit.example" '{username:$u,password:"x"}')"; expect "a username that does not exist" 401
audit "q=ghost-$T"; check "  the attempt is recorded too" "$(f "$(ev '.action=="SIGN_IN_FAILED"')" .note)" "Unknown username"
HR_PW=$(genpw)
rq "$FIRST" POST /auth/change-password "$(json --arg c "$HR_TEMP" --arg n "$HR_PW" '{currentPassword:$c,newPassword:$n}')"; expect "choose a new password" 200; HR=$(echo "$BODY" | jq -r .token)
audit "q=$T&action=PASSWORD_CHANGED"; E=$(ev '.actorUsername=="'$HR_NAME'"'); check "  recorded as PASSWORD_CHANGED, by them" "$(f "$E" .action)" "PASSWORD_CHANGED"
check "  neither password is in the trail" "$(echo "$EV" | grep -cF -e "$HR_PW" -e "$HR_TEMP")" 0
activate "$EMP_NAME" "$EMP_TEMP"; EMP=$ACTIVATED
for i in 1 2 3 4 5; do rq "" POST /auth/login "$(json --arg u "$T-lock@audit.example" '{username:$u,password:"wrong"}')"; done
audit "q=$T-lock@"; check "  five wrong passwords: five entries and one about the lockout" "$(total)" 6
has "  the lockout is recorded" "$(echo "$EV" | jq -r '[.content[].summary]|join(" | ")')" "is locked out for a while"
rq "" POST /auth/login "$(json --arg u "$T-lock@audit.example" '{username:$u,password:"wrong"}')"; expect "a sixth attempt is refused (429)" 429
audit "q=$T-lock@"; check "  attempts that are turned away are not added (they could flood the trail)" "$(total)" 6

echo "--- A DEPARTMENT, FROM CREATION TO DELETION (by HR)"
rq "$HR" POST /department/create "$(json --arg n "$T-dept" --arg c "${T:2:8}" '{name:$n,code:$c,description:"first description"}')"; expect "create" 200; DEPT=$(id)
audit "entityId=$DEPT"; check "  one entry so far" "$(total)" 1; E=$(ev 'true')
check "  CREATED, a department, by HR" "$(f "$E" '[.action,.entityType,.actorUsername,.actorRole]|join(" ")')" "CREATED DEPARTMENT $HR_NAME HR"
check "  the sentence" "$(f "$E" .summary)" "Created department $T-dept"
check "  the fields it started with, from nothing" "$(echo "$E" | jq -c '[.changes[]|select(.field=="Description")|{o:.oldValue,n:.newValue}][0]')" '{"o":null,"n":"first description"}'
rq "$HR" POST /department/create "$(json --arg n "$T-dept" --arg c "X$N" '{name:$n,code:$c}')"; expect "a duplicate is refused" 409
audit "q=$T-dept"; check "  and leaves no trace: the failed change was rolled back with its entry" "$(total)" 1
rq "$HR" PUT /department/$DEPT "$(json --arg n "$T-dept" --arg c "${T:2:8}" '{name:$n,code:$c,description:"second description"}')"; expect "change the description" 200
audit "entityId=$DEPT"; check "  two entries, the newest first" "$(f "$(echo "$EV" | jq -c '.content[0]')" .action)" "UPDATED"
E=$(ev '.action=="UPDATED"')
check "  only the field that changed is listed, before and after" "$(echo "$E" | jq -c '[.changes[]|{f:.field,o:.oldValue,n:.newValue}]')" '[{"f":"Description","o":"first description","n":"second description"}]'
check "  the sentence names it" "$(f "$E" .summary)" "Changed department $T-dept: Description"
rq "$HR" PUT /department/$DEPT "$(json --arg n "$T-dept" --arg c "${T:2:8}" '{name:$n,code:$c,description:"second description"}')"; expect "save again with nothing different" 200
audit "entityId=$DEPT"; check "  nothing is added for a save that changed nothing" "$(total)" 2
EMP_D=$(emp 3 Dora "$DEPT")
rq "$HR" DELETE /department/$DEPT; expect "delete the department (it has an employee)" 204
audit "entityId=$DEPT"; E=$(ev '.action=="DELETED"')
check "  DELETED, with what it held" "$(echo "$E" | jq -c '[.changes[]|select(.field=="Name")|{o:.oldValue,n:.newValue}][0]')" '{"o":"'$T-dept'","n":null}'
check "  a note about what else happened" "$(f "$E" .note)" "1 employee no longer belongs to a department"
check "  the name is kept, though the record is gone" "$(f "$E" .entityLabel)" "$T-dept"
check "  the whole story of the record, newest first" "$(echo "$EV" | jq -r '[.content[].action]|join(",")')" "DELETED,UPDATED,CREATED"
rq "$HR" GET /department/search/$DEPT; expect "  (the department really is gone)" 404

echo "--- EMPLOYEE, PROFILE AND THE SENSITIVE VALUES"
NID=$(printf '%016d' $(date +%s)); DOB="1991-07-23"
rq "$HR" POST /employee-profile/create "$(json --arg n "$NID" --arg d "$DOB" '{nationalId:$n,dateOfBirth:$d,educationLevel:"Bachelor",profilePhotoUrl:"https://photos.example/a.png"}')"; expect "create a profile" 200; PROF=$(id)
audit "entityId=$PROF"; E=$(ev '.action=="CREATED"')
check "  the profile is recorded" "$(f "$E" .entityType)" "PROFILE"
check "  the national ID field is listed, but hidden" "$(echo "$E" | jq -c '[.changes[]|select(.field=="National ID")|{o:.oldValue,n:.newValue}][0]')" '{"o":null,"n":"(hidden)"}'
check "  so is the date of birth" "$(echo "$E" | jq -c '[.changes[]|select(.field=="Date of birth")|.newValue][0]')" '"(hidden)"'
check "  the education level is an ordinary field" "$(echo "$E" | jq -c '[.changes[]|select(.field=="Education level")|.newValue][0]')" '"Bachelor"'
rq "$HR" PUT /employee-profile/$PROF "$(json --arg n "$NID" --arg d "$DOB" '{nationalId:$n,dateOfBirth:$d,educationLevel:"Master",profilePhotoUrl:"https://photos.example/a.png"}')"; expect "change only the education" 200
audit "entityId=$PROF"; E=$(ev '.action=="UPDATED"'); check "  only the education is listed" "$(echo "$E" | jq -r '[.changes[].field]|join(",")')" "Education level"
NID2=$(printf '%016d' $(( $(date +%s) + 1 )))
rq "$HR" PUT /employee-profile/$PROF "$(json --arg n "$NID2" --arg d "$DOB" '{nationalId:$n,dateOfBirth:$d,educationLevel:"Master",profilePhotoUrl:"https://photos.example/a.png"}')"; expect "change the national ID" 200
audit "entityId=$PROF&action=UPDATED"; E=$(echo "$EV" | jq -c '.content[0]')
check "  the change is noticed" "$(echo "$E" | jq -r '[.changes[].field]|join(",")')" "National ID"
check "  without either value" "$(echo "$E" | jq -c '[.changes[0].oldValue,.changes[0].newValue]')" '["(hidden)","(hidden)"]'
rq "$HR" POST /employee/create "$(json --arg e "$T-emp9@x.com" --arg ph "+25078${N}09" --arg p "$PROF" '{firstName:"Petra",lastName:"Audit'"$TU"'",email:$e,phone:$ph,gender:"FEMALE",status:"ACTIVE",hireDate:"2024-02-02",profile:{id:$p}}')"; expect "create an employee with that profile" 200; EMP_P=$(id)
audit "entityId=$EMP_P"; E=$(ev '.action=="CREATED"'); check "  the employee's entry says a profile is recorded, nothing more" "$(echo "$E" | jq -c '[.changes[]|select(.field=="Profile")|.newValue][0]')" '"Recorded"'
rq "$HR" PUT /employee/$EMP_P "$(json --arg e "$T-emp9@x.com" --arg ph "+25078${N}19" '{firstName:"Petra",lastName:"Audit'"$TU"'",email:$e,phone:$ph,gender:"FEMALE",status:"INACTIVE",hireDate:"2024-02-02"}')"; expect "change the phone and the status" 200
audit "entityId=$EMP_P&action=UPDATED"; E=$(echo "$EV" | jq -c '.content[0]')
check "  both fields, before and after" "$(echo "$E" | jq -c '[.changes[]|{f:.field,o:.oldValue,n:.newValue}]|sort_by(.f)')" '[{"f":"Phone","o":"+25078'${N}'09","n":"+25078'${N}'19"},{"f":"Status","o":"Active","n":"Inactive"}]'
check "  the profile link was not touched, so it is not listed" "$(echo "$E" | jq -r '[.changes[].field]|map(select(.=="Profile"))|length')" 0
rq "$ADMIN_TOKEN" POST /training/create "$(json --arg t "$T-course" '{title:$t}')"; TRAINING=$(id)
rq "$HR" POST /training/$TRAINING/assign/$EMP_P; expect "enrol her in a training" 200
rq "$HR" POST /leave/create "$(json --arg e "$EMP_P" '{startDate:"2026-12-01",endDate:"2026-12-02",type:"SICK",employee:{id:$e}}')"; LV_P=$(id)
rq "$HR" DELETE /employee/$EMP_P; expect "delete the employee" 204
audit "entityId=$EMP_P&action=DELETED"; E=$(echo "$EV" | jq -c '.content[0]')
check "  DELETED, with a note of everything that went with her" "$(f "$E" .note)" "Also removed: their profile, 1 leave request, 1 training enrolment"
check "  what she was, for the record" "$(echo "$E" | jq -c '[.changes[]|select(.field=="First name")|.oldValue][0]')" '"Petra"'
audit "entityId=$PROF&action=DELETED"; check "  the profile went with the employee: it is listed in that entry's note, not as an entry of its own" "$(total)" 0
audit "size=100"; check "  the national ID and the date of birth appear nowhere in the trail" "$(echo "$EV" | grep -c -e "$NID" -e "$NID2" -e "$DOB")" 0
has "  the trail knows the profile was hidden-by-design" "$(echo "$EV" | jq -r '[.content[].changes[]?.newValue]|join(" ")')" "(hidden)"

echo "--- LEAVE REQUESTS: who decided what"
rq "$EMP" POST /me/leave '{"startDate":"2026-11-02","endDate":"2026-11-04","type":"ANNUAL","reason":"trip"}'; expect "an employee asks for leave" 200; LV1=$(id)
audit "entityId=$LV1"; E=$(ev '.action=="CREATED"'); check "  recorded, by the employee's own account" "$(f "$E" '[.actorUsername,.actorRole,.entityType]|join(" ")')" "$EMP_NAME EMPLOYEE LEAVE_REQUEST"
has "  the label says whose and when" "$(f "$E" .entityLabel)" "Esther Audit$TU · Annual · 2026-11-02 to 2026-11-04"
rq "$EMP" PUT /me/leave/$LV1 '{"startDate":"2026-11-02","endDate":"2026-11-06","type":"ANNUAL","reason":"trip"}'; expect "they change the last day" 200
audit "entityId=$LV1&action=UPDATED"; check "  the change shows the date" "$(echo "$EV" | jq -c '[.content[0].changes[]|{f:.field,o:.oldValue,n:.newValue}]')" '[{"f":"End date","o":"2026-11-04","n":"2026-11-06"}]'
rq "$HR" PATCH /leave/$LV1/approve; expect "HR approves" 200
audit "entityId=$LV1&action=LEAVE_APPROVED"; E=$(echo "$EV" | jq -c '.content[0]'); check "  LEAVE_APPROVED, by HR" "$(f "$E" '[.actorUsername,.actorRole]|join(" ")')" "$HR_NAME HR"
has "  the sentence" "$(f "$E" .summary)" "Approved leave request Esther Audit$TU"
rq "$HR" PATCH /leave/$LV1/reject '{"reason":"Not enough cover that week"}'; expect "a second decision is refused" 409
audit "entityId=$LV1"; check "  and adds nothing" "$(echo "$EV" | jq -r '[.content[].action]|join(",")')" "LEAVE_APPROVED,UPDATED,CREATED"
rq "$EMP" POST /me/leave '{"startDate":"2026-12-10","endDate":"2026-12-10","type":"SICK"}'; LV2=$(id)
rq "$HR" PATCH /leave/$LV2/reject '{"reason":"Not enough cover that week"}'; expect "HR rejects another" 200
audit "entityId=$LV2&action=LEAVE_REJECTED"; check "  LEAVE_REJECTED" "$(total)" 1
rq "$EMP" POST /me/leave '{"startDate":"2026-12-20","endDate":"2026-12-20","type":"UNPAID"}'; LV3=$(id)
rq "$EMP" DELETE /me/leave/$LV3; expect "the employee withdraws a pending request" 204
audit "entityId=$LV3"; check "  LEAVE_WITHDRAWN, then nothing else" "$(echo "$EV" | jq -r '[.content[].action]|join(",")')" "LEAVE_WITHDRAWN,CREATED"
rq "$HR" DELETE /leave/$LV2; expect "HR deletes a decided request" 204
audit "entityId=$LV2&action=DELETED"; check "  DELETED, with its old status" "$(echo "$EV" | jq -c '[.content[0].changes[]|select(.field=="Status")|.oldValue][0]')" '"Rejected"'
rq "$ADMIN_TOKEN" POST /leave/create "$(json --arg e "$EMP_HR" '{startDate:"2026-12-01",endDate:"2026-12-01",type:"SICK",employee:{id:$e}}')"; LVH=$(id)
rq "$HR" PATCH /leave/$LVH/approve; expect "HR may not decide their own request" 403
audit "entityId=$LVH"; check "  and the refusal leaves nothing but the creation" "$(echo "$EV" | jq -r '[.content[].action]|join(",")')" "CREATED"
rq "$ADMIN_TOKEN" POST /leave/create "$(json --arg e "$EMP_E" '{startDate:"2026-12-03",endDate:"2026-12-03",type:"SICK",employee:{id:$e}}')"; LVH2=$(id)
rq "$HR" PATCH /leave/$LVH2/approve; expect "HR decides a request of somebody else" 200

echo "--- TRAININGS AND LOCATIONS"
audit "entityId=$TRAINING"; check "  the training created earlier is recorded" "$(f "$(ev '.action=="CREATED"')" .summary)" "Created training $T-course"
rq "$HR" POST /training/$TRAINING/assign/$EMP_E; expect "enrol" 200
audit "entityId=$TRAINING&action=TRAINING_ENROLLED"; has "  TRAINING_ENROLLED names both" "$(f "$(echo "$EV" | jq -c '.content[0]')" .summary)" "Enrolled Esther Audit$TU in $T-course"
audit "entityId=$TRAINING&action=TRAINING_ENROLLED"; ENROLLED_BEFORE=$(total)
rq "$HR" POST /training/$TRAINING/assign/$EMP_E; expect "enrolling twice is refused" 409
audit "entityId=$TRAINING&action=TRAINING_ENROLLED"; check "  and adds nothing" "$(total)" "$ENROLLED_BEFORE"
rq "$HR" DELETE /training/$TRAINING/remove/$EMP_E; expect "remove her" 200
audit "entityId=$TRAINING&action=TRAINING_REMOVED"; check "  TRAINING_REMOVED" "$(total)" 1
rq "$HR" POST /training/$TRAINING/assign/$EMP_E
rq "$HR" DELETE /training/$TRAINING; expect "delete the training with one person in it" 204
audit "entityId=$TRAINING&action=DELETED"; check "  the note says so" "$(f "$(echo "$EV" | jq -c '.content[0]')" .note)" "1 person was removed from it"
rq "$HR" POST /location/create "$(json --arg n "$T-prov" --arg c "A$N" '{name:$n,type:"PROVINCE",code:$c}')"; PROV=$(id)
rq "$HR" POST /location/create "$(json --arg n "$T-dist" --arg p "$PROV" '{name:$n,type:"DISTRICT",parent:{id:$p}}')"; DIST=$(id)
audit "entityId=$DIST"; check "  a district is recorded with the place it is inside" "$(echo "$(ev '.action=="CREATED"')" | jq -c '[.changes[]|select(.field=="Inside")|.newValue][0]')" '"'$T-prov'"'
rq "$HR" PUT /location/$PROV "$(json --arg n "$T-prov-renamed" --arg c "A$N" '{name:$n,type:"PROVINCE",code:$c}')"; expect "rename the province" 200
audit "entityId=$PROV&action=UPDATED"; check "  the rename is recorded" "$(echo "$EV" | jq -c '[.content[0].changes[]|{f:.field,o:.oldValue,n:.newValue}]')" '[{"f":"Name","o":"'$T-prov'","n":"'$T-prov-renamed'"}]'
rq "$HR" DELETE /location/$PROV; expect "delete the province (with its district)" 204
audit "entityId=$PROV&action=DELETED"; check "  the note counts what went with it" "$(f "$(echo "$EV" | jq -c '.content[0]')" .note)" "1 place inside it was deleted too"

echo "--- ACCOUNTS"
rq "$ADMIN_TOKEN" PUT /user/$HR_ID "$(json --arg e "$EMP_HR" '{role:"ADMIN",enabled:true,employeeId:$e}')"; expect "make the HR user an administrator" 200
audit "entityId=$HR_ID&action=ACCOUNT_UPDATED"; check "  ACCOUNT_UPDATED lists the role, before and after" "$(echo "$EV" | jq -c '[.content[0].changes[]|{f:.field,o:.oldValue,n:.newValue}]')" '[{"f":"Role","o":"Hr","n":"Admin"}]'
rq "$ADMIN_TOKEN" PUT /user/$HR_ID "$(json --arg e "$EMP_HR" '{role:"HR",enabled:false,employeeId:$e}')"; expect "demote and switch off" 200
audit "entityId=$HR_ID&action=ACCOUNT_UPDATED"; check "  switching off is listed" "$(echo "$EV" | jq -r '.content[0].changes|map(.field)|sort|join(",")')" "Role,Status"
rq "$ADMIN_TOKEN" PUT /user/$HR_ID "$(json --arg e "$EMP_HR" '{role:"HR",enabled:true,employeeId:$e}')"
rq "$ADMIN_TOKEN" POST /user/$HR_ID/reset-password; expect "reset the password" 200; RESET_TEMP=$(echo "$BODY" | jq -r .temporaryPassword)
audit "entityId=$HR_ID&action=PASSWORD_RESET"; has "  PASSWORD_RESET is recorded" "$(f "$(echo "$EV" | jq -c '.content[0]')" .summary)" "Reset the password of $HR_NAME"
audit "size=100"; check "  the new temporary password is not in the trail either" "$(echo "$EV" | grep -cF "$RESET_TEMP")" 0

echo "--- THE TRAIL IS READ-ONLY, AND ADMINISTRATORS ONLY"
activate "$HR_NAME" "$RESET_TEMP"; HR="$ACTIVATED"   # the reset above ended their old session, by design
rq "" GET /audit/search-page; expect "no token -> 401" 401
rq "$HR" GET /audit/search-page; expect "HR -> 403" 403
rq "$EMP" GET /audit/search-page; expect "an employee -> 403" 403
rq "$ADMIN_TOKEN" POST /audit/search-page '{}'; expect "nothing can be added through the API" 405
rq "$ADMIN_TOKEN" PUT /audit/search-page '{}'; expect "nothing can be changed" 405
rq "$ADMIN_TOKEN" DELETE /audit/search-page; expect "nothing can be deleted" 405
rq "$ADMIN_TOKEN" DELETE "/audit/$(echo "$EV" | jq -r '.content[0].id')"; expect "and there is no route to an entry by its id" 404

echo "--- FILTERS, SORTING AND PAGING"
audit "q=$T"; ALL=$(total)
check "  the test left a good number of entries" "$([ "$ALL" -ge 40 ] && echo yes)" yes
audit "q=$T&action=CREATED"; check "  by action: only CREATED" "$(echo "$EV" | jq '[.content[]|select(.action!="CREATED")]|length')" 0
audit "q=$T&entityType=LEAVE_REQUEST"; check "  by kind of record: nothing else comes back" "$(echo "$EV" | jq '[.content[]|select(.entityType!="LEAVE_REQUEST")]|length')" 0
check "  (and it found some)" "$([ "$(total)" -ge 5 ] && echo yes)" yes
audit "q=$T&actor=$T-emp@"; check "  by who did it (part of the username)" "$(echo "$EV" | jq '[.content[]|select(.actorUsername|contains("'$T'-emp@")|not)]|length')" 0
audit "q=Esther%20Audit$TU"; check "  by text in the record's name (ignores case)" "$([ "$(total)" -ge 3 ] && echo yes)" yes
audit "q=esther%20audit$(echo $TU | tr A-Z a-z)"; check "  in lower case too" "$([ "$(total)" -ge 3 ] && echo yes)" yes
audit "q=$T&from=$TODAY&to=$TODAY"; check "  a date range that is today finds them all" "$(total)" "$ALL"
audit "q=$T&from=$TOMORROW"; check "  from tomorrow finds none" "$(total)" 0
audit "q=$T&to=$YESTERDAY"; check "  up to yesterday finds none" "$(total)" 0
audit "q=$T&action=LEAVE_APPROVED&actor=$T-hr@&entityType=LEAVE_REQUEST"; check "  filters combine (approvals by the HR user)" "$([ "$(total)" -ge 2 ] && echo yes)" yes
audit "q=$T&size=5"; check "  a page of 5" "$(echo "$EV" | jq '.content|length')" 5; check "  says how many pages" "$(echo "$EV" | jq '.page.totalPages > 1')" true
audit "q=$T&sortBy=occurredAt&direction=desc&size=10"; check "  newest first by default: times never go up" "$(echo "$EV" | jq '[.content[].occurredAt]|. == (sort|reverse)')" true
audit "q=$T&sortBy=occurredAt&direction=asc&size=10"; check "  oldest first on request" "$(echo "$EV" | jq '[.content[].occurredAt]|. == sort')" true
rq "$ADMIN_TOKEN" GET "/audit/search-page?sortBy=password"; expect "sorting by something else -> 400" 400
rq "$ADMIN_TOKEN" GET "/audit/search-page?action=EXPLODED"; expect "an unknown action -> 400" 400
rq "$ADMIN_TOKEN" GET "/audit/search-page?from=yesterday"; expect "a date that is not a date -> 400" 400
rq "$ADMIN_TOKEN" GET "/audit/search-page?entityId=not-a-uuid"; expect "an id that is not an id -> 400" 400
rq "$ADMIN_TOKEN" GET "/audit/search-page?size=500"; expect "a page size over the limit -> 400" 400

echo "--- ENTRIES OUTLIVE THE ACCOUNTS AND RECORDS THEY DESCRIBE"
audit "q=$T&actor=$T-hr@"; BEFORE=$(total)
rq "$ADMIN_TOKEN" DELETE /user/$HR_ID; expect "delete the HR account that did all that" 204
audit "q=$T&actor=$T-hr@"; check "  every entry of theirs is still there (none lost, none added under their name)" "$(total)" "$BEFORE"
check "  still naming them" "$(echo "$EV" | jq -r '[.content[]|select(.actorUsername=="'$HR_NAME'")]|length > 0')" true
audit "entityId=$HR_ID&action=ACCOUNT_DELETED"; check "  and the deletion of the account is an entry, by the administrator" "$(f "$(echo "$EV" | jq -c '.content[0]')" .actorUsername)" "$ADMIN_USER"
rq "$ADMIN_TOKEN" DELETE /user/$EMP_ID >/dev/null; rq "$ADMIN_TOKEN" DELETE /employee/$EMP_E; expect "delete the employee of the other account" 204
audit "entityId=$EMP_E&action=DELETED"; check "  a deleted employee's entry still reads properly" "$(f "$(echo "$EV" | jq -c '.content[0]')" .entityLabel)" "Esther Audit$TU"
for e in $EMP_HR $EMP_D; do rq "$ADMIN_TOKEN" DELETE /employee/$e; done

echo; echo "RESULT: $PASS passed, $FAIL failed"
