#!/bin/bash
# Login, tokens and roles: rejected and forged tokens, the forced first-login password change, what each role may
# call, self-service limits (you only ever reach your own data), nobody approving their own leave, revocation
# (switch off / reset / role change / delete take effect at once), lockout after repeated wrong passwords,
# and the safety rules for accounts. Creates its own test accounts (random passwords) and removes them.
# Needs: curl, jq, openssl, a running API (API_BASE, default http://localhost:8082) and ADMIN_PASSWORD.
B="${API_BASE:-http://localhost:8082}"
J='Content-Type: application/json'
. "$(dirname "$0")/auth.sh"   # signs in as the administrator: sets $TOKEN and $AUTH
ADMIN_TOKEN="$TOKEN"; ADMIN_ID=$(echo "$_LOGIN" | jq -r '.user.id')
HDR=$(mktemp); trap 'rm -f "$HDR"' EXIT
PASS=0; FAIL=0

# rq TOKEN METHOD PATH [BODY]: a request with the given token ("" = none); sets CODE, BODY and the response headers in $HDR
rq() { local tok=$1 m=$2 p=$3 d=$4; local args=(-s -m 10 -D "$HDR" -w "\n%{http_code}" -X "$m")
  [ -n "$tok" ] && args+=(-H "Authorization: Bearer $tok"); [ -n "$d" ] && args+=(-H "$J" -d "$d")
  R=$(curl "${args[@]}" "$B$p"); CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); }
expect() { if [ "$CODE" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($CODE)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected $2 got $CODE :: $BODY" | cut -c1-260; fi; }
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 (= $3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected '$3' got '$2'"; fi; }
msg() { echo "$BODY" | jq -r '.message'; }
keys() { echo "$BODY" | jq -c '.errors|keys'; }
genpw() { printf 'Pw%s9x' "$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 12)"; }
b64url() { printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='; }
T=zz$(date +%s); N=$(date +%s | tail -c 6)
json() { jq -nc "$@"; }

# mkuser USERNAME ROLE [EMPLOYEE_ID]: creates an account as the administrator, sets NEW_ID and NEW_TEMP
mkuser() { rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$1" --arg r "$2" --arg e "$3" '{username:$u,role:$r,employeeId:(if $e=="" then null else $e end)}')"
  NEW_ID=$(echo "$BODY" | jq -r '.user.id'); NEW_TEMP=$(echo "$BODY" | jq -r '.temporaryPassword'); }
# activate USERNAME TEMP: signs in with the temporary password, chooses a new one, sets ACTIVATED (the new token) and ACTIVATED_PW
activate() { local pw; pw=$(genpw)
  rq "" POST /auth/login "$(json --arg u "$1" --arg p "$2" '{username:$u,password:$p}')"; expect "  $1 signs in with the temporary password" 200
  local first; first=$(echo "$BODY" | jq -r '.token')
  rq "$first" POST /auth/change-password "$(json --arg c "$2" --arg n "$pw" '{currentPassword:$c,newPassword:$n}')"; expect "  $1 chooses a new password" 200
  ACTIVATED=$(echo "$BODY" | jq -r '.token'); ACTIVATED_PW=$pw; }
emp() { rq "$ADMIN_TOKEN" POST /employee/create "$(json --arg e "$T-$1@x.com" --arg ph "+25078${N}0$1" --arg f "$2" '{firstName:$f,lastName:"Security",email:$e,phone:$ph,gender:"FEMALE",status:"ACTIVE",hireDate:"2024-01-01"}')"; echo "$BODY" | jq -r '.id'; }

echo "--- NO TOKEN, BAD TOKENS"
rq "" GET /department/search-all; expect "no token -> 401" 401; check "  message" "$(msg)" "Sign in to continue"
check "  asks for a Bearer token" "$(grep -i '^www-authenticate' "$HDR" | tr -d '\r' | cut -d' ' -f2)" "Bearer"
rq "not.a.token" GET /department/search-all; expect "garbage token -> 401" 401; check "  message" "$(msg)" "Your session has expired or is no longer valid. Sign in again."
rq "${TOKEN:0:${#TOKEN}-3}abc" GET /department/search-all; expect "token with a tampered signature -> 401" 401
H=$(b64url '{"alg":"none","typ":"JWT"}'); P=$(b64url "{\"sub\":\"$ADMIN_ID\",\"iss\":\"smarthr\",\"exp\":4102444800,\"ver\":0}")
rq "$H.$P." GET /department/search-all; expect "unsigned token (alg none) -> 401" 401
H=$(b64url '{"alg":"HS256","typ":"JWT"}'); SIG=$(printf '%s.%s' "$H" "$P" | openssl dgst -sha256 -hmac "an-attackers-own-secret-0123456789abcdef" -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
rq "$H.$P.$SIG" GET /department/search-all; expect "token signed with somebody else's key -> 401" 401
rq "" GET /v3/api-docs; expect "the API docs stay public" 200

echo "--- LOGIN"
rq "" POST /auth/login '{}'; expect "empty login -> 400" 400; check "  fields" "$(keys)" '["password","username"]'
rq "" POST /auth/login "$(json --arg u "$ADMIN_USER" '{username:$u,password:"definitely-wrong"}')"; expect "wrong password -> 401" 401; WRONG_PW_MSG=$(msg)
rq "" POST /auth/login "$(json --arg u "nobody-$T@example.com" '{username:$u,password:"definitely-wrong"}')"; expect "unknown username -> 401" 401
check "  same message, so nobody can tell which usernames exist" "$(msg)" "$WRONG_PW_MSG"
check "  the message" "$WRONG_PW_MSG" "Incorrect username or password"
rq "" POST /auth/login "$(json --arg u "$(echo $ADMIN_USER | tr a-z A-Z)" --arg p "$ADMIN_PASSWORD" '{username:$u,password:$p}')"; expect "the username ignores upper/lower case" 200
check "  token expires in the future" "$(echo "$BODY" | jq -r '(.expiresAt | sub("\\.[0-9]+Z$";"Z") | fromdateiso8601) > now')" true
check "  the answer never contains a password or hash" "$(echo "$BODY" | grep -ci 'passwordhash\|\$2a\$\|\$2b\$')" 0
CORS=$(curl -s -D - -o /dev/null -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type" "$B/auth/login")
check "  browser preflight from the React app is allowed" "$(echo "$CORS" | tr -d '\r' | grep -i '^access-control-allow-origin' | cut -d' ' -f2)" "http://localhost:5173"
CORS=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS -H "Origin: http://evil.example" -H "Access-Control-Request-Method: POST" "$B/auth/login")
check "  preflight from another website is refused" "$CORS" 403

echo "--- CREATING ACCOUNTS (administrator)"
EMP_E=$(emp 1 Esther); EMP_H=$(emp 2 Hugo); EMP_X=$(emp 3 Xavier)
mkuser "$T-hr@sec.example" HR ""; expect "create an HR account without an employee" 200; HR_ID=$NEW_ID; HR_TEMP=$NEW_TEMP
check "  a temporary password is returned, 12 characters" "${#HR_TEMP}" 12
check "  it must be changed at first login" "$(echo "$BODY" | jq -r '.user.mustChangePassword')" true
check "  the account has no password field" "$(echo "$BODY" | jq -c '.user | keys')" '["createdAt","employee","enabled","id","mustChangePassword","role","username"]'
mkuser "$T-emp@sec.example" EMPLOYEE $EMP_E; expect "create an EMPLOYEE account linked to an employee" 200; EMP_ID=$NEW_ID; EMP_TEMP=$NEW_TEMP
check "  the account shows the employee's name" "$(echo "$BODY" | jq -r '.user.employee.firstName')" "Esther"
mkuser "$T-hr2@sec.example" HR $EMP_H; expect "an HR account may be linked to an employee too" 200; HR2_ID=$NEW_ID; HR2_TEMP=$NEW_TEMP
mkuser "$T-adm2@sec.example" ADMIN ""; expect "create a second administrator" 200; ADM2_ID=$NEW_ID; ADM2_TEMP=$NEW_TEMP
rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$T-hr@sec.example" '{username:$u,role:"HR"}')"; expect "duplicate username -> 409" 409; check "  field" "$(keys)" '["username"]'
rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$(echo $T-HR@SEC.EXAMPLE)" '{username:$u,role:"HR"}')"; expect "duplicate username in other letter case -> 409" 409
rq "$ADMIN_TOKEN" POST /user/create '{"username":"not-an-email","role":"HR"}'; expect "username that is not an email -> 400" 400; check "  field" "$(keys)" '["username"]'
rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$T-x@sec.example" '{username:$u,role:"EMPLOYEE"}')"; expect "EMPLOYEE account without an employee -> 400" 400; check "  field" "$(keys)" '["employeeId"]'
rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$T-y@sec.example" --arg e "$EMP_E" '{username:$u,role:"EMPLOYEE",employeeId:$e}')"; expect "second account for the same employee -> 409" 409; check "  field" "$(keys)" '["employeeId"]'
rq "$ADMIN_TOKEN" POST /user/create "$(json --arg u "$T-z@sec.example" '{username:$u,role:"EMPLOYEE",employeeId:"00000000-0000-0000-0000-000000000000"}')"; expect "unknown employee -> 404" 404
rq "$ADMIN_TOKEN" POST /user/create '{"username":"a@b.example","role":"KING"}'; expect "unknown role -> 400" 400

echo "--- FORCED PASSWORD CHANGE AT FIRST LOGIN"
rq "" POST /auth/login "$(json --arg u "$T-hr@sec.example" --arg p "$HR_TEMP" '{username:$u,password:$p}')"; expect "sign in with the temporary password" 200
HR_FIRST=$(echo "$BODY" | jq -r '.token'); check "  the login says the password must be changed" "$(echo "$BODY" | jq -r '.user.mustChangePassword')" true
rq "$HR_FIRST" GET /me; expect "  GET /me is allowed" 200
rq "$HR_FIRST" GET /employee/search-all; expect "  anything else is refused with 403" 403; check "  and says why" "$(echo "$BODY" | jq -r '.code')" "PASSWORD_CHANGE_REQUIRED"
rq "$HR_FIRST" GET /dashboard/summary; expect "  the dashboard too" 403
rq "$HR_FIRST" POST /auth/change-password "$(json --arg c "wrong-current" '{currentPassword:$c,newPassword:"SomethingNew123"}')"; expect "wrong current password -> 400 (not 401, so the app does not sign out)" 400; check "  field" "$(keys)" '["currentPassword"]'
rq "$HR_FIRST" POST /auth/change-password "$(json --arg c "$HR_TEMP" '{currentPassword:$c,newPassword:"short"}')"; expect "new password too short -> 400" 400; check "  field" "$(keys)" '["newPassword"]'
rq "$HR_FIRST" POST /auth/change-password "$(json --arg c "$HR_TEMP" '{currentPassword:$c,newPassword:$c}')"; expect "the same password again -> 400" 400; check "  field" "$(keys)" '["newPassword"]'
rq "$HR_FIRST" POST /auth/change-password "$(json --arg c "$HR_TEMP" --arg n "$T-hr@sec.example" '{currentPassword:$c,newPassword:$n}')"; expect "password equal to the username -> 400" 400
HR_PW=$(genpw)
rq "$HR_FIRST" POST /auth/change-password "$(json --arg c "$HR_TEMP" --arg n "$HR_PW" '{currentPassword:$c,newPassword:$n}')"; expect "choose a new password" 200
HR=$(echo "$BODY" | jq -r '.token'); check "  the flag is cleared" "$(echo "$BODY" | jq -r '.user.mustChangePassword')" false
rq "$HR_FIRST" GET /me; expect "the token from before the change stops working" 401
rq "$HR" GET /employee/search-all; expect "the new token works" 200
rq "" POST /auth/login "$(json --arg u "$T-hr@sec.example" --arg p "$HR_TEMP" '{username:$u,password:$p}')"; expect "the temporary password no longer works" 401
activate "$T-emp@sec.example" "$EMP_TEMP"; EMP=$ACTIVATED; EMP_PW=$ACTIVATED_PW
activate "$T-hr2@sec.example" "$HR2_TEMP"; HR2=$ACTIVATED
activate "$T-adm2@sec.example" "$ADM2_TEMP"; ADM2=$ACTIVATED

echo "--- WHO MAY CALL WHAT (administrator / HR / employee)"
probe() { rq "$1" "$2" "$3" "$4"; expect "$5 $2 $3" "$6"; }
for route in /dashboard/summary /employee/search-all /department/search-all /location/type/PROVINCE /training/search-all /leave/search-page /employee-profile/search-all; do
  probe "$ADMIN_TOKEN" GET $route "" "ADMIN   " 200
  probe "$HR"          GET $route "" "HR      " 200
  probe "$EMP"         GET $route "" "EMPLOYEE" 403
done
probe "$ADMIN_TOKEN" GET /user/search-all "" "ADMIN   " 200
probe "$HR"          GET /user/search-all "" "HR      " 403
probe "$EMP"         GET /user/search-all "" "EMPLOYEE" 403
for who in "$ADMIN_TOKEN" "$HR" "$EMP"; do probe "$who" GET /me "" "any role" 200; done
rq "$HR" POST /user/create "$(json '{username:"hr-makes-admin@x.example",role:"ADMIN"}')"; expect "HR cannot create accounts" 403; check "  message" "$(msg)" "You do not have permission to do that"
rq "$EMP" POST /department/create '{"name":"Nope","code":"NO"}'; expect "an employee cannot create a department" 403
rq "$EMP" POST /employee/create '{}'; expect "an employee cannot create an employee (403 before validation)" 403
rq "$EMP" PATCH /leave/00000000-0000-0000-0000-000000000000/approve; expect "an employee cannot approve leave" 403
rq "$HR" POST /department/create "$(json --arg n "$T-dept" --arg c "${T:2:8}" '{name:$n,code:$c}')"; expect "HR can write HR data" 200; DEPT=$(echo "$BODY" | jq -r '.id')
rq "$HR" DELETE /department/$DEPT; expect "  and delete it" 204
rq "$ADMIN_TOKEN" GET /user/search-all; check "  the account list never contains a password or hash" "$(echo "$BODY" | grep -ci 'passwordhash\|\$2a\$\|\$2b\$')" 0
rq "$ADMIN_TOKEN" GET /nope/route; expect "unknown route: 404 for a signed-in person" 404
rq "" GET /nope/route; expect "unknown route: 401 for everybody else" 401

echo "--- SELF-SERVICE: an employee reaches only their own data"
rq "$EMP" GET /me; expect "my profile" 200; check "  the employee behind the account" "$(echo "$BODY" | jq -r '.employee.firstName')" "Esther"
check "  and the account" "$(echo "$BODY" | jq -r '.user.role')" "EMPLOYEE"
rq "$EMP" GET /me/leave; expect "my leave, none yet" 200; check "  empty" "$(echo "$BODY" | jq length)" 0
rq "$EMP" POST /me/leave "$(json --arg o "$EMP_H" '{startDate:"2026-11-02",endDate:"2026-11-04",type:"ANNUAL",reason:"mine",employee:{id:$o}}')"; expect "submit leave, naming somebody else in the body" 200; MY_LEAVE=$(echo "$BODY" | jq -r '.id')
check "  it was filed for me anyway" "$(echo "$BODY" | jq -r '.employee.firstName')" "Esther"; check "  and starts pending" "$(echo "$BODY" | jq -r '.status')" "PENDING"
rq "$EMP" POST /me/leave '{"startDate":"2026-11-09","endDate":"2026-11-05","type":"SICK"}'; expect "end before start -> 400" 400; check "  field" "$(keys)" '["endDate"]'
rq "$EMP" POST /me/leave '{}'; expect "empty request -> 400" 400; check "  fields (no employee field: it is not theirs to choose)" "$(keys)" '["endDate","startDate","type"]'
rq "$HR2" POST /me/leave '{"startDate":"2026-12-01","endDate":"2026-12-02","type":"SICK","reason":"hr2"}'; expect "HR linked to an employee can file their own leave" 200; HR2_LEAVE=$(echo "$BODY" | jq -r '.id')
rq "$EMP" GET /me/leave; check "  the employee sees only their own request" "$(echo "$BODY" | jq -r '[.[].reason]|join(",")')" "mine"
rq "$EMP" PUT /me/leave/$HR2_LEAVE '{"startDate":"2026-12-01","endDate":"2026-12-09","type":"SICK"}'; expect "edit somebody else's request -> 404 (not 403: it is not even shown to exist)" 404
rq "$EMP" DELETE /me/leave/$HR2_LEAVE; expect "withdraw somebody else's request -> 404" 404
rq "$EMP" PUT /me/leave/$MY_LEAVE '{"startDate":"2026-11-02","endDate":"2026-11-06","type":"ANNUAL","reason":"longer"}'; expect "edit my own pending request" 200; check "  saved" "$(echo "$BODY" | jq -r '.endDate')" "2026-11-06"
rq "$HR" PATCH /leave/$MY_LEAVE/approve; expect "HR approves it" 200
rq "$EMP" PUT /me/leave/$MY_LEAVE '{"startDate":"2026-11-02","endDate":"2026-11-07","type":"ANNUAL"}'; expect "edit after the decision -> 409" 409
rq "$EMP" DELETE /me/leave/$MY_LEAVE; expect "withdraw after the decision -> 409" 409
rq "$EMP" POST /me/leave '{"startDate":"2026-12-10","endDate":"2026-12-11","type":"UNPAID"}'; TO_WITHDRAW=$(echo "$BODY" | jq -r '.id')
rq "$EMP" DELETE /me/leave/$TO_WITHDRAW; expect "withdraw a pending request of my own" 204
rq "$HR2" PATCH /leave/$HR2_LEAVE/approve; expect "HR cannot approve their own leave request" 403; check "  message" "$(msg)" "You cannot decide your own leave request"
rq "$HR2" PATCH /leave/$HR2_LEAVE/reject '{"reason":"Not enough cover that week"}'; expect "nor reject it" 403
rq "$HR" PATCH /leave/$HR2_LEAVE/approve; expect "another HR user can" 200
rq "$ADMIN_TOKEN" POST /training/create "$(json --arg t "$T-course" '{title:$t}')"; TRAINING=$(echo "$BODY" | jq -r '.id')
rq "$EMP" GET /me/trainings; expect "my trainings" 200; check "  none yet" "$(echo "$BODY" | jq length)" 0
rq "$HR" POST /training/$TRAINING/assign/$EMP_E; expect "HR enrols me" 200
rq "$EMP" GET /me/trainings; check "  now it shows up" "$(echo "$BODY" | jq -r '[.[].title]|join(",")')" "$T-course"
rq "$HR" DELETE /training/$TRAINING; expect "remove the course" 204
rq "$HR" GET /me/leave; expect "an account with no employee has no leave to show -> 409" 409
check "  message" "$(msg)" "Your account is not linked to an employee record, so there is nothing to show here"
rq "$HR" GET /me; expect "  but /me still works" 200; check "  employee is null" "$(echo "$BODY" | jq -r '.employee')" "null"

echo "--- CHANGES TAKE EFFECT AT ONCE (no waiting for a token to expire)"
rq "$ADMIN_TOKEN" PUT /user/$EMP_ID "$(json --arg e "$EMP_E" '{role:"EMPLOYEE",enabled:false,employeeId:$e}')"; expect "switch the employee's account off" 200
rq "$EMP" GET /me; expect "  their token stops working immediately" 401
rq "" POST /auth/login "$(json --arg u "$T-emp@sec.example" --arg p "$EMP_PW" '{username:$u,password:$p}')"; expect "  and they cannot sign in" 401; check "  with the same message as a wrong password" "$(msg)" "Incorrect username or password"
rq "$ADMIN_TOKEN" PUT /user/$EMP_ID "$(json --arg e "$EMP_E" '{role:"EMPLOYEE",enabled:true,employeeId:$e}')"; expect "switch it back on" 200
rq "$EMP" GET /me; expect "  the same token works again" 200
rq "$ADMIN_TOKEN" POST /user/$EMP_ID/reset-password; expect "reset their password" 200; RESET_TEMP=$(echo "$BODY" | jq -r '.temporaryPassword')
check "  a new temporary password" "$([ "${#RESET_TEMP}" = 12 ] && [ "$RESET_TEMP" != "$EMP_PW" ] && echo yes)" yes
rq "$EMP" GET /me; expect "  they are signed out everywhere" 401
rq "" POST /auth/login "$(json --arg u "$T-emp@sec.example" --arg p "$EMP_PW" '{username:$u,password:$p}')"; expect "  the old password is dead" 401
rq "" POST /auth/login "$(json --arg u "$T-emp@sec.example" --arg p "$RESET_TEMP" '{username:$u,password:$p}')"; expect "  the new temporary one works" 200; check "  and must be changed" "$(echo "$BODY" | jq -r '.user.mustChangePassword')" true
activate "$T-emp@sec.example" "$RESET_TEMP"; EMP=$ACTIVATED
rq "$ADMIN_TOKEN" PUT /user/$HR2_ID "$(json '{role:"HR",enabled:true}')"; expect "unlink the second HR account from its employee" 200
rq "$ADMIN_TOKEN" PUT /user/$HR_ID "$(json '{role:"EMPLOYEE",enabled:true}')"; expect "demote to EMPLOYEE without an employee -> 400" 400; check "  field" "$(keys)" '["employeeId"]'
rq "$ADMIN_TOKEN" PUT /user/$HR_ID "$(json --arg e "$EMP_X" '{role:"EMPLOYEE",enabled:true,employeeId:$e}')"; expect "demote HR to EMPLOYEE (linked to an employee)" 200
rq "$HR" GET /employee/search-all; expect "  their old HR token loses HR access immediately (the role is read from the database)" 403
rq "$HR" GET /me; expect "  but it is still a valid login" 200
rq "$ADMIN_TOKEN" PUT /user/$HR_ID "$(json '{role:"HR",enabled:true}')"; expect "promote back to HR" 200
rq "$HR" GET /employee/search-all; expect "  HR access is back" 200

echo "--- ACCOUNT SAFETY"
rq "$ADMIN_TOKEN" DELETE /user/$ADMIN_ID; expect "you cannot delete your own account" 409; check "  message" "$(msg)" "You cannot delete your own account"
rq "$ADMIN_TOKEN" PUT /user/$ADMIN_ID "$(json '{role:"ADMIN",enabled:false}')"; expect "you cannot switch off your own account" 409
rq "$ADMIN_TOKEN" PUT /user/$ADMIN_ID "$(json '{role:"HR",enabled:true}')"; expect "you cannot demote yourself" 409
rq "$ADMIN_TOKEN" GET /me; expect "  and you are still signed in" 200
rq "$ADMIN_TOKEN" PUT /user/$ADM2_ID "$(json '{role:"HR",enabled:true}')"; expect "another administrator may be demoted while one other stays" 200
rq "$ADMIN_TOKEN" PUT /user/$ADM2_ID "$(json '{role:"ADMIN",enabled:true}')"; expect "  and promoted again" 200
rq "$ADMIN_TOKEN" GET /user/search/00000000-0000-0000-0000-000000000000; expect "unknown account -> 404" 404
rq "$ADMIN_TOKEN" PUT /user/$HR_ID '{}'; expect "update with nothing -> 400" 400

echo "--- LOCKOUT AFTER REPEATED WRONG PASSWORDS"
mkuser "$T-lock@sec.example" HR ""; LOCK_ID=$NEW_ID; LOCK_TEMP=$NEW_TEMP
for i in 1 2 3 4 5; do rq "" POST /auth/login "$(json --arg u "$T-lock@sec.example" '{username:$u,password:"wrong-password"}')"; [ "$CODE" = 401 ] || echo "   attempt $i answered $CODE"; done
check "  five wrong passwords are each answered 401" "$CODE" 401
rq "" POST /auth/login "$(json --arg u "$T-lock@sec.example" '{username:$u,password:"wrong-password"}')"; expect "the sixth attempt is locked out -> 429" 429
check "  message" "$(msg | cut -c1-58)" "Too many failed attempts. Try again in 10 minute(s)."
check "  Retry-After header tells when" "$(grep -i '^retry-after' "$HDR" | tr -d '\r' | cut -d' ' -f2 | awk '{print ($1 > 0 && $1 <= 601) ? "ok" : "bad:" $1}')" ok
rq "" POST /auth/login "$(json --arg u "$T-lock@sec.example" --arg p "$LOCK_TEMP" '{username:$u,password:$p}')"; expect "even the right password is refused while locked" 429
rq "" POST /auth/login "$(json --arg u "$T-hr@sec.example" --arg p "$HR_PW" '{username:$u,password:$p}')"; expect "another account is not affected" 200
for i in 1 2 3 4 5; do rq "" POST /auth/login "$(json --arg u "ghost-$T@example.com" '{username:$u,password:"x"}')"; done
rq "" POST /auth/login "$(json --arg u "ghost-$T@example.com" '{username:$u,password:"x"}')"; expect "a username that does not exist locks the same way (no way to tell it apart)" 429
rq "$ADMIN_TOKEN" DELETE /user/$LOCK_ID; expect "remove the locked test account" 204

echo "--- DELETING AN EMPLOYEE REMOVES THEIR LOGIN"
EMP_Y=$(emp 4 Yvonne); mkuser "$T-gone@sec.example" EMPLOYEE $EMP_Y; GONE_ID=$NEW_ID; GONE_TEMP=$NEW_TEMP; activate "$T-gone@sec.example" "$GONE_TEMP"; GONE=$ACTIVATED
rq "$GONE" GET /me; expect "  they are signed in" 200
rq "$HR" DELETE /employee/$EMP_Y; expect "HR deletes the employee" 204
rq "$ADMIN_TOKEN" GET /user/search/$GONE_ID; expect "  their account is gone" 404
rq "$GONE" GET /me; expect "  and so is their access" 401

echo "--- CLEANUP"
for a in $HR_ID $EMP_ID $HR2_ID $ADM2_ID; do rq "$ADMIN_TOKEN" DELETE /user/$a; done
for e in $EMP_E $EMP_H $EMP_X; do rq "$ADMIN_TOKEN" DELETE /employee/$e; done
rq "$ADMIN_TOKEN" GET /user/search-all
check "  none of the test accounts is left" "$(echo "$BODY" | jq "[.[]|select(.username|startswith(\"$T-\"))]|length")" 0
rq "$ADMIN_TOKEN" GET /me; expect "  the administrator is still signed in" 200

echo; echo "RESULT: $PASS passed, $FAIL failed"
