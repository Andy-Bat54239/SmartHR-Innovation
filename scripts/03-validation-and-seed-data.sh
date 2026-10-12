#!/bin/bash
# Bean Validation rules on every entity (one 400 listing all broken fields) and the seed data.
# Needs: curl, jq, a running API (API_BASE, default http://localhost:8082) and ADMIN_PASSWORD. Removes what it creates;
# the seeded provinces / districts / sectors / departments are left alone.
B="${API_BASE:-http://localhost:8082}"
J='Content-Type: application/json'
. "$(dirname "$0")/auth.sh"   # signs in as the administrator: sets $TOKEN and $AUTH
PASS=0; FAIL=0
req() { local m=$1 p=$2 d=$3
  if [ -n "$d" ]; then R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$J" -H "$AUTH" -d "$d" "$B$p"); else R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$AUTH" "$B$p"); fi
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); }
expect() { if [ "$CODE" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($CODE)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected $2 got $CODE :: $BODY" | cut -c1-300; fi; }
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 (= $3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected '$3' got '$2'"; fi; }
ge() { if [ "$2" -ge "$3" ] 2>/dev/null; then PASS=$((PASS+1)); echo "PASS  $1 ($2 >= $3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected >= $3 got '$2'"; fi; }
id() { echo "$BODY" | jq -r '.id'; }
keys() { echo "$BODY" | jq -c '.errors|keys'; }
err() { echo "$BODY" | jq -r ".errors.$1"; }
rep() { printf "$1%.0s" $(seq 1 $2); }
T=ZZ$(date +%s); N=$(date +%s | tail -c 6)
TODAY=$(date +%Y-%m-%d)
NEXT_YEAR=$(date -v+1y +%Y-%m-%d 2>/dev/null || date -d "+1 year" +%Y-%m-%d)
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
J_() { jq -nc "$@"; }

echo "--- DEPARTMENT VALIDATION"
req POST /department/create '{}'; expect "empty body -> 400" 400
check "  message" "$(echo $BODY | jq -r .message)" "Validation failed"
check "  all broken fields reported at once" "$(keys)" '["code","name"]'
check "  name msg" "$(err name)" "Name is required"
req POST /department/create '{"name":"   ","code":"A B"}'; expect "blank name + code with a space -> 400" 400
check "  fields" "$(keys)" '["code","name"]'
check "  code msg" "$(err code)" "Code may only contain letters, digits, '-' and '_'"
req POST /department/create "$(J_ --arg n "$(rep a 101)" '{name:$n,code:"OK"}')"; expect "name too long -> 400" 400
check "  msg" "$(err name)" "Name must be at most 100 characters"
req POST /department/create "$(J_ --arg n "$T-Dept" --arg c "$T-D" '{name:$n,code:$c,description:"d"}')"; expect "valid department" 200; D=$(id)
req PUT /department/$D "$(J_ --arg c "$T-D" '{name:"",code:$c}')"; expect "update with blank name -> 400" 400
req PUT /department/$D "$(J_ --arg n "$T-Dept" --arg c "$T-D" '{name:$n,code:$c,description:"changed"}')"; expect "valid update" 200

echo "--- EMPLOYEE VALIDATION"
req POST /employee/create '{}'; expect "empty body -> 400" 400
check "  seven fields reported" "$(keys)" '["email","firstName","gender","hireDate","lastName","phone","status"]'
EMP() { # overrides as a jq expression applied to a valid base
  jq -nc --arg e "$T-$RANDOM@x.com" --arg ph "$(printf '+25078%07d' $(( (RANDOM*32768+RANDOM) % 10000000 )))" --arg d "$TODAY" \
   "{firstName:\"Ann\",lastName:\"Uwase\",email:\$e,phone:\$ph,gender:\"FEMALE\",status:\"ACTIVE\",hireDate:\$d} | $1"; }
req POST /employee/create "$(EMP '.email="not-an-email"')"; expect "bad email -> 400" 400
check "  msg" "$(err email)" "Email must be a well-formed email address"
for bad in "0781234" "+250701234567" "+2507881234" "0788123456789" "078-812-3456" "+25078812345a"; do
  req POST /employee/create "$(EMP ".phone=\"$bad\"")"; expect "phone '$bad' rejected" 400
done
check "  phone msg" "$(err phone)" "Phone must be a Rwandan mobile number like +250788123456 or 0788123456"
req POST /employee/create "$(EMP ".hireDate=\"$NEXT_YEAR\"")"; expect "hire date next year -> 400" 400
check "  msg" "$(err hireDate)" "Hire date cannot be in the future"
req POST /employee/create "$(EMP ".hireDate=\"$TOMORROW\"")"; expect "hire date tomorrow -> 400" 400
req POST /employee/create "$(EMP ".firstName=\"$(rep a 51)\"")"; expect "first name over 50 -> 400" 400
req POST /employee/create "$(EMP '.gender="ROBOT"')"; expect "unknown enum value -> 400" 400
check "  message" "$(echo $BODY | jq -r .message)" "Malformed or invalid request body"
req POST /employee/create "$(EMP '.firstName=""')"; expect "blank first name -> 400" 400
req POST /employee/create "$(EMP ".hireDate=\"$TODAY\" | .phone=\"0788$(printf '%06d' $N)\"")"; expect "valid: hired today, local phone format 0788xxxxxx" 200; E1=$(id)
req POST /employee/create "$(EMP ".phone=\"+25073$(printf '%07d' $N)\"")"; expect "valid: +250 73 prefix" 200; E2=$(id)
req PUT /employee/$E1 "$(EMP '.phone="12345"')"; expect "update with bad phone -> 400" 400
req PUT /employee/$E1 "$(EMP ".phone=\"0788$(printf '%06d' $N)\" | .lastName=\"Changed\"")"; expect "valid update keeps own phone" 200

echo "--- PROFILE VALIDATION"
req POST /employee-profile/create '{}'; expect "empty body -> 400" 400
check "  fields" "$(keys)" '["dateOfBirth","educationLevel","nationalId"]'
for bad in "12345" "123456789012345" "12345678901234567" "abcdefghijklmnop" "1234 5678 9012 34"; do
  req POST /employee-profile/create "$(J_ --arg n "$bad" '{nationalId:$n,dateOfBirth:"1990-01-01",educationLevel:"BSc"}')"; expect "national id '$bad' rejected" 400
done
check "  msg" "$(err nationalId)" "National ID must be exactly 16 digits"
NID=$(printf '%016d' $(date +%s))
req POST /employee-profile/create "$(J_ --arg n "$NID" --arg d "$NEXT_YEAR" '{nationalId:$n,dateOfBirth:$d,educationLevel:"BSc"}')"; expect "future date of birth -> 400" 400
check "  msg" "$(err dateOfBirth)" "Date of birth must be in the past"
req POST /employee-profile/create "$(J_ --arg n "$NID" '{nationalId:$n,dateOfBirth:"1990-01-01",educationLevel:" "}')"; expect "blank education -> 400" 400
req POST /employee-profile/create "$(J_ --arg n "$NID" --arg u "$(rep u 256)" '{nationalId:$n,dateOfBirth:"1990-01-01",educationLevel:"BSc",profilePhotoUrl:$u}')"; expect "photo url over 255 -> 400" 400
req POST /employee-profile/create "$(J_ --arg n "$NID" '{nationalId:$n,dateOfBirth:"1990-01-01",educationLevel:"BSc"}')"; expect "valid profile (16 digits)" 200; P1=$(id)

echo "--- LOCATION / TRAINING / LEAVE VALIDATION"
req POST /location/create '{}'; expect "location empty -> 400" 400; check "  fields" "$(keys)" '["name","type"]'
req POST /location/create '{"name":"x","type":"PROVINCE","code":"ELEVEN-CHAR"}'; expect "location code over 10 -> 400" 400
check "  msg" "$(err code)" "Code must be at most 10 characters"
req POST /training/create '{}'; expect "training empty -> 400" 400; check "  fields" "$(keys)" '["title"]'
req POST /training/create "$(J_ --arg t "$(rep t 201)" '{title:$t}')"; expect "training title over 200 -> 400" 400
req POST /leave/create '{}'; expect "leave empty -> 400" 400; check "  fields, the employee included" "$(keys)" '["employee","endDate","startDate","type"]'
req POST /leave/create "$(J_ --arg r "$(rep r 1001)" --arg e "$E1" '{startDate:"2026-03-01",endDate:"2026-03-02",type:"SICK",reason:$r,employee:{id:$e}}')"; expect "leave reason over 1000 -> 400" 400
req POST /leave/create "$(J_ --arg e "$E1" '{startDate:"2026-03-01",endDate:"2026-03-02",type:"SICK",employee:{id:$e}}')"; expect "valid leave" 200

echo "--- BAD INPUT THAT BELONGS TO ONE FIELD (400 + errors)"
req POST /leave/create "$(J_ --arg e "$E1" '{startDate:"2026-03-05",endDate:"2026-03-01",type:"SICK",employee:{id:$e}}')"; expect "leave: end before start -> 400" 400
check "  field" "$(keys)" '["endDate"]'
check "  message" "$(err endDate)" "End date cannot be before start date"
req POST /leave/create '{"startDate":"2026-03-01","endDate":"2026-03-02","type":"SICK"}'; expect "leave without an employee -> 400" 400
check "  field" "$(keys)" '["employee"]'
check "  message" "$(err employee)" "Choose the employee this leave is for"
req POST /training/create "$(J_ --arg t "$T-ord" '{title:$t,startDate:"2026-05-10",endDate:"2026-05-01"}')"; expect "training: end before start -> 400" 400
check "  field" "$(keys)" '["endDate"]'
check "  message" "$(err endDate)" "End date cannot be before start date"
req GET /location/type/DISTRICT; SEED_DISTRICT=$(echo $BODY | jq -r '.[0].id')
req POST /location/create "$(J_ --arg p "$SEED_DISTRICT" '{name:"Skips a level",type:"CELL",parent:{id:$p}}')"; expect "cell directly under a district -> 400" 400
check "  field" "$(keys)" '["parent"]'
check "  message" "$(err parent)" "A cell must be inside a sector, not a district"
req POST /location/create '{"name":"Orphan","type":"SECTOR"}'; expect "sector with no parent -> 400" 400
check "  field" "$(keys)" '["parent"]'
check "  message" "$(err parent)" "A sector must be inside a district"
req GET "/employee/search-page?size=0"; expect "a 400 that is not about one field (page size)" 400
check "  has no 'errors'" "$(echo $BODY | jq -r '.errors // "none"')" "none"

echo "--- DUPLICATES NAME THEIR FIELD (409 + errors)"
req GET /employee/search/$E1; E1_EMAIL=$(echo $BODY | jq -r .email); E1_PHONE=$(echo $BODY | jq -r .phone)
req POST /department/create "$(J_ --arg n "$T-Dept" --arg c "$T-X" '{name:$n,code:$c}')"; expect "duplicate department name -> 409" 409
check "  field" "$(keys)" '["name"]'
req POST /department/create "$(J_ --arg n "$T-Other" --arg c "$T-D" '{name:$n,code:$c}')"; expect "duplicate department code -> 409" 409
check "  field" "$(keys)" '["code"]'
req POST /employee/create "$(EMP ".email=\"$E1_EMAIL\"")"; expect "duplicate email -> 409" 409
check "  field" "$(keys)" '["email"]'
check "  message still readable" "$(echo $BODY | jq -r .message)" "Email already in use: $E1_EMAIL"
req POST /employee/create "$(EMP ".phone=\"$E1_PHONE\"")"; expect "duplicate phone -> 409" 409
check "  field" "$(keys)" '["phone"]'
req POST /employee-profile/create "$(J_ --arg n "$NID" '{nationalId:$n,dateOfBirth:"1990-01-01",educationLevel:"BSc"}')"; expect "duplicate national id -> 409" 409
check "  field" "$(keys)" '["nationalId"]'
req POST /location/create "$(J_ --arg c "D$N" '{name:"Dup-A",type:"PROVINCE",code:$c}')"; expect "province for the duplicate test" 200; LDUP=$(id)
req POST /location/create "$(J_ --arg c "D$N" '{name:"Dup-B",type:"PROVINCE",code:$c}')"; expect "duplicate location code -> 409" 409
check "  field" "$(keys)" '["code"]'
req POST /training/create "$(J_ --arg t "$T-Train" '{title:$t}')"; expect "training for the duplicate test" 200; TDUP=$(id)
req POST /training/create "$(J_ --arg t "$T-Train" '{title:$t}')"; expect "duplicate training title -> 409" 409
check "  field" "$(keys)" '["title"]'
req POST /training/$TDUP/assign/$E1; expect "enrol" 200
req POST /training/$TDUP/assign/$E1; expect "enrol twice -> 409" 409
check "  a conflict that is not about one field has no 'errors'" "$(echo $BODY | jq -r '.errors // "none"')" "none"
req DELETE /training/$TDUP; expect "remove test training" 204
req DELETE /location/$LDUP; expect "remove test province" 204

echo "--- SEED DATA"
req GET /location/type/PROVINCE; expect "provinces" 200
ge "  province count" "$(echo $BODY | jq length)" 5
check "  seeded codes" "$(echo $BODY | jq -r '[.[].code]|map(select(.=="KIG" or .=="NOR" or .=="SOU" or .=="EAS" or .=="WES"))|sort|join(",")')" "EAS,KIG,NOR,SOU,WES"
req GET /location/type/DISTRICT; ge "  district count" "$(echo $BODY | jq length)" 30
check "  Gasabo parent is Kigali City" "$(echo $BODY | jq -r '[.[]|select(.name=="Gasabo")][0].parent.name')" "Kigali City"
GAS=$(echo $BODY | jq -r '[.[]|select(.name=="Gasabo")][0].id')
req GET /location/$GAS/children; check "  Gasabo sectors" "$(echo $BODY | jq length)" 15
KIM=$(echo $BODY | jq -r '[.[]|select(.name=="Kimironko")][0].id')
req GET /location/type/SECTOR; ge "  sector count (Kigali City)" "$(echo $BODY | jq length)" 35
req GET /department/search-all; ge "  department count" "$(echo $BODY | jq length)" 6
check "  HR department" "$(echo $BODY | jq -r '[.[]|select(.code=="HR")][0].name')" "Human Resources"
echo "   integration: employee placed in seeded sector Kimironko is found by province"
req PUT /employee/$E2 "$(jq -nc --arg l "$KIM" --arg e "$T-upd@x.com" --arg ph "+25073$(printf '%07d' $N)" --arg d "$TODAY" '{firstName:"Ann",lastName:"Uwase",email:$e,phone:$ph,gender:"FEMALE",status:"ACTIVE",hireDate:$d,location:{id:$l}}')"; expect "place employee in Kimironko" 200
req GET /employee/province/code/KIG; expect "by seeded province code KIG" 200
check "  contains the employee" "$(echo $BODY | jq -r "[.[]|select(.id==\"$E2\")]|length")" 1
req GET "/employee/province/name/kigali%20city"; check "  by name (case-insensitive)" "$(echo $BODY | jq -r "[.[]|select(.id==\"$E2\")]|length")" 1
req GET /employee/$E2/location; check "  path" "$(echo $BODY | jq -r '[.[].name]|join(" > ")')" "Kigali City > Gasabo > Kimironko"

echo "--- CLEANUP (only rows this script created; seed data stays)"
req DELETE /employee/$E1; req DELETE /employee/$E2
req DELETE /employee-profile/$P1; expect "delete profile" 204
req DELETE /department/$D; expect "delete department" 204

echo; echo "RESULT: $PASS passed, $FAIL failed"
