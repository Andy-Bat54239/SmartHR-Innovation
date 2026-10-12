#!/bin/bash
# GET /dashboard/summary: headcount by department and province (employees placed at any level roll up to their
# province), unassigned groups, pending leave, who is on leave today (people, not requests) and who is available,
# trainings by phase, the six-month headcount series, upcoming leave and the newest hires.
# Every figure is checked as a change against a snapshot taken first, so other data in the database cannot interfere.
# Needs: curl, jq, a running API (API_BASE, default http://localhost:8082) and ADMIN_PASSWORD. Removes what it creates.
B="${API_BASE:-http://localhost:8082}"
J='Content-Type: application/json'
. "$(dirname "$0")/auth.sh"   # signs in as the administrator: sets $TOKEN and $AUTH
PASS=0; FAIL=0
req() { local m=$1 p=$2 d=$3
  if [ -n "$d" ]; then R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$J" -H "$AUTH" -d "$d" "$B$p"); else R=$(curl -s -m 10 -w "\n%{http_code}" -X $m -H "$AUTH" "$B$p"); fi
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d'); }
expect() { if [ "$CODE" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $1 ($CODE)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected $2 got $CODE :: $BODY" | cut -c1-300; fi; }
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS  $1 (= $3)"; else FAIL=$((FAIL+1)); echo "FAIL  $1 expected '$3' got '$2'"; fi; }
id() { echo "$BODY" | jq -r '.id'; }
T=ZZ$(date +%s); N=$(date +%s | tail -c 6)

# dates relative to today (BSD/macOS first, GNU/Linux fallback)
shift_days() { date -v"$1"d +%F 2>/dev/null || date -d "$1 days" +%F; }
TODAY=$(date +%F); YESTERDAY=$(shift_days -1); TOMORROW=$(shift_days +1); NEXT_WEEK=$(shift_days +7); LAST_WEEK=$(shift_days -7)

snap() { req GET /dashboard/summary; S="$BODY"; }
val() { echo "$S" | jq -r "$1"; }                                   # value in the current snapshot
valc() { echo "$S" | jq -c "$1"; }                                  # the same, as compact JSON (for whole objects)
delta() { echo $(( $(echo "$S" | jq "$1") - $(echo "$S0" | jq "$1") )); }   # change since the first snapshot
group() { echo "$S" | jq -r --arg list "$1" --arg n "$2" '.[$list] | map(select(.name==$n))[0].count // 0'; }
group0() { echo "$S0" | jq -r --arg list "$1" --arg n "$2" '.[$list] | map(select(.name==$n))[0].count // 0'; }
position() { echo "$S" | jq -r --arg list "$1" --arg n "$2" '.[$list] | map(.name) | index($n)'; }

echo "--- SNAPSHOT BEFORE"
snap; expect "summary" 200; S0="$S"
check "  top-level shape" "$(echo "$S" | jq -c 'keys')" '["byDepartment","byProvince","employees","headcountByMonth","leave","recentEmployees","trainings","upcomingLeave"]'
check "  employees add up" "$(( $(val .employees.active) + $(val .employees.inactive) ))" "$(val .employees.total)"
check "  available today is between 0 and the active staff" "$([ "$(val .employees.availableToday)" -ge 0 ] && [ "$(val .employees.availableToday)" -le "$(val .employees.active)" ] && echo yes)" yes

echo "--- SETUP"
req POST /department/create "$(jq -nc --arg n "$T-Dept" --arg c "$T-D" '{name:$n,code:$c}')"; D=$(id)
req POST /department/create "$(jq -nc --arg n "$T-Empty" --arg c "$T-E" '{name:$n,code:$c}')"; D0=$(id)
req POST /location/create "$(jq -nc --arg n "$T-North" --arg c "A$N" '{name:$n,type:"PROVINCE",code:$c}')"; PA=$(id)
req POST /location/create "$(jq -nc --arg n "$T-South" --arg c "B$N" '{name:$n,type:"PROVINCE",code:$c}')"; PB=$(id)
mk() { req POST /location/create "$(jq -nc --arg n "$1" --arg t "$2" --arg p "$3" '{name:$n,type:$t,parent:{id:$p}}')"; id; }
A_DIST=$(mk "$T-A-Dist" DISTRICT $PA); A_SEC=$(mk "$T-A-Sec" SECTOR $A_DIST); A_CELL=$(mk "$T-A-Cell" CELL $A_SEC); A_VIL=$(mk "$T-A-Vil" VILLAGE $A_CELL)
B_DIST=$(mk "$T-B-Dist" DISTRICT $PB); B_SEC=$(mk "$T-B-Sec" SECTOR $B_DIST)
emp() { # index status dept loc
  req POST /employee/create "$(jq -nc --arg e "$T-$1@x.com" --arg ph "+25078${N}0$1" --arg s "$2" --arg d "$3" --arg l "$4" \
    '{firstName:"Dash",lastName:"Board",email:$e,phone:$ph,gender:"FEMALE",status:$s,hireDate:"2024-01-01",
      department:(if $d=="" then null else {id:$d} end), location:(if $l=="" then null else {id:$l} end)}')"
  [ "$CODE" = 200 ] || echo "   !! employee $1 failed: $CODE $BODY" >&2; id; }
E1=$(emp 1 ACTIVE   $D $A_VIL)           # village inside province A
E2=$(emp 2 ACTIVE   $D $A_DIST)         # attached at district level, still inside province A
E3=$(emp 3 INACTIVE $D $B_SEC)          # sector inside province B
E4=$(emp 4 ACTIVE   ""  "")             # no department, no location
lv() { req POST /leave/create "$(jq -nc --arg e "$1" --arg s "$2" --arg f "$3" '{startDate:$s,endDate:$f,type:"ANNUAL",employee:{id:$e}}')"; id; }
L1=$(lv $E1 $NEXT_WEEK $NEXT_WEEK)                                   # pending
L2=$(lv $E1 $NEXT_WEEK $NEXT_WEEK)                                   # pending
L3=$(lv $E1 $YESTERDAY $TOMORROW); req PATCH /leave/$L3/approve      # approved, covers today
L4=$(lv $E2 $NEXT_WEEK $NEXT_WEEK); req PATCH /leave/$L4/approve     # approved, but in the future
L5=$(lv $E2 $YESTERDAY $TOMORROW); req PATCH /leave/$L5/reject '{"reason":"Not enough cover that week"}'       # covers today, but rejected
L6=$(lv $E3 $LAST_WEEK $YESTERDAY); req PATCH /leave/$L6/approve     # approved, already over (but it covered this day a week ago)
L7=$(lv $E1 $YESTERDAY $TODAY); req PATCH /leave/$L7/approve         # a second, overlapping approved request of the same person
tr() { req POST /training/create "$1"; id; }
T1=$(tr "$(jq -nc --arg t "$T-ongoing" --arg s $YESTERDAY --arg e $TOMORROW '{title:$t,startDate:$s,endDate:$e}')")
T2=$(tr "$(jq -nc --arg t "$T-upcoming" --arg s $TOMORROW --arg e $NEXT_WEEK '{title:$t,startDate:$s,endDate:$e}')")
T3=$(tr "$(jq -nc --arg t "$T-completed" --arg s $LAST_WEEK --arg e $YESTERDAY '{title:$t,startDate:$s,endDate:$e}')")
T4=$(tr "$(jq -nc --arg t "$T-unscheduled" '{title:$t}')")
T5=$(tr "$(jq -nc --arg t "$T-end-only" --arg e $TOMORROW '{title:$t,endDate:$e}')")   # only an end date in the future
echo "   created 4 employees, 7 leave requests, 5 trainings"

echo "--- EMPLOYEES"
snap; expect "summary after setup" 200
check "  total +4" "$(delta .employees.total)" 4
check "  active +3" "$(delta .employees.active)" 3
check "  inactive +1" "$(delta .employees.inactive)" 1
check "  available today +2 (3 new active people, one of them on leave)" "$(delta .employees.availableToday)" 2

echo "--- BY DEPARTMENT"
check "  my department has 3" "$(group byDepartment "$T-Dept")" 3
check "  an empty department is still listed, with 0" "$(group byDepartment "$T-Empty")" 0
check "  it is listed at all" "$(val '.byDepartment|map(.name)|index("'$T-Empty'") != null')" true
check "  biggest first: the department with 3 comes before the empty one" "$(( $(position byDepartment "$T-Dept") < $(position byDepartment "$T-Empty") ))" 1
check "  employees with no department: +1" "$(( $(group byDepartment "No department") - $(group0 byDepartment "No department") ))" 1
check "  the 'No department' bar comes last" "$(val '.byDepartment|last|.name')" "No department"
check "  and has no id" "$(val '.byDepartment|last|.id')" "null"
check "  seeded departments are listed" "$(val '[.byDepartment[]|select(.name=="Human Resources")]|length')" 1

echo "--- BY PROVINCE"
check "  province A: village + district-level employee roll up" "$(group byProvince "$T-North")" 2
check "  province B: a sector-level employee rolls up" "$(group byProvince "$T-South")" 1
check "  employees with no location: +1" "$(( $(group byProvince "No location") - $(group0 byProvince "No location") ))" 1
check "  the 'No location' bar comes last" "$(val '.byProvince|last|.name')" "No location"
check "  every seeded province is listed" "$(val '[.byProvince[]|select(.name=="Kigali City" or .name=="Eastern Province" or .name=="Northern Province" or .name=="Southern Province" or .name=="Western Province")]|length')" 5
check "  province bars hold only provinces, never a district" "$(val '[.byProvince[]|select(.name|test("-Dist$"))]|length')" 0

echo "--- LEAVE"
check "  pending +2" "$(delta .leave.pending)" 2
check "  on leave today +1 (approved AND covering today)" "$(delta .leave.onLeaveToday)" 1
check "  ...and it counts people: two overlapping requests of one person are one" "$(delta .leave.onLeaveToday)" 1
check "  on leave a week ago +1 (a request that covered exactly that day)" "$(delta .leave.onLeaveLastWeek)" 1

echo "--- HEADCOUNT BY MONTH"
check "  six months" "$(val '.headcountByMonth|length')" 6
check "  the last one is this month" "$(val '.headcountByMonth|last|.month')" "$(date +%Y-%m)"
check "  oldest first, one month after the other" "$(val '[.headcountByMonth[].month] == ([.headcountByMonth[].month]|sort)')" true
check "  a person is counted from the month of hiring, so the total never goes down" "$(val '[.headcountByMonth[].total] == ([.headcountByMonth[].total]|sort)')" true
check "  the last month is everyone on record" "$(val '.headcountByMonth|last|.total')" "$(val .employees.total)"
check "  the four people hired in 2024 are in every month (+4 each)" "$(valc '[.headcountByMonth[].total]')" "$(echo "$S0" | jq -c '[.headcountByMonth[].total|.+4]')"

echo "--- UPCOMING LEAVE (approved, not over yet, soonest first)"
check "  at most five" "$([ "$(val '.upcomingLeave|length')" -le 5 ] && echo yes)" yes
check "  none of them is over" "$(val '[.upcomingLeave[]|select(.endDate < "'$TODAY'")]|length')" 0
check "  soonest first" "$(val '[.upcomingLeave[]|.startDate] == ([.upcomingLeave[]|.startDate]|sort)')" true
check "  a pending, a rejected and an ended request are never listed" "$(val '[.upcomingLeave[].id] | map(select(. == "'$L1'" or . == "'$L2'" or . == "'$L5'" or . == "'$L6'")) | length')" 0
# the list holds five at most, so on a database that already has a lot of leave the new ones may not make it in
ROOM=$([ "$(val '.upcomingLeave|length')" -lt 5 ] && echo yes || echo no)
if [ "$ROOM" = yes ]; then
  check "  the approved request that is under way is listed" "$(val '[.upcomingLeave[].id]|index("'$L3'") != null')" true
  check "  and the one next week" "$(val '[.upcomingLeave[].id]|index("'$L4'") != null')" true
  check "  under-way comes before next week" "$(val '[.upcomingLeave[].id]|(index("'$L3'") < index("'$L4'"))')" true
  check "  it carries who, what and when" "$(val '[.upcomingLeave[]|select(.id=="'$L3'")][0]|[.employee.firstName,.employee.lastName,.type,.startDate,.endDate]|join(",")')" "Dash,Board,ANNUAL,$YESTERDAY,$TOMORROW"
  check "  and a picture field (empty for someone without a profile)" "$(val '[.upcomingLeave[]|select(.id=="'$L3'")][0]|.employee|keys|join(",")')" "firstName,id,lastName,photoUrl"
fi

echo "--- TRAININGS"
check "  ongoing +2 (dates around today, and end date only)" "$(delta .trainings.ongoing)" 2
check "  upcoming +1" "$(delta .trainings.upcoming)" 1
check "  completed +1" "$(delta .trainings.completed)" 1
check "  unscheduled +1" "$(delta .trainings.unscheduled)" 1

echo "--- LIVE: a change shows up on the next request"
req DELETE /employee/$E2; expect "delete the district-level employee" 204
snap
check "  province A drops to 1" "$(group byProvince "$T-North")" 1
check "  department drops to 2" "$(group byDepartment "$T-Dept")" 2
check "  total is +3" "$(delta .employees.total)" 3

echo "--- NEWEST HIRES"
snap; S1="$S"
req POST /employee/create "$(jq -nc --arg e "$T-5@x.com" --arg ph "+25078${N}05" --arg d "$D" --arg l "$A_VIL" --arg h "$TODAY" \
  '{firstName:"Newest",lastName:"Hire",email:$e,phone:$ph,gender:"MALE",status:"ACTIVE",hireDate:$h,department:{id:$d},location:{id:$l}}')"; expect "hire somebody today" 200; E5=$(id)
snap
check "  this month's total is +1" "$(( $(echo "$S" | jq '.headcountByMonth|last|.total') - $(echo "$S1" | jq '.headcountByMonth|last|.total') ))" 1
check "  last month's total is unchanged (she was hired after it ended)" "$(echo "$S" | jq '.headcountByMonth[-2].total')" "$(echo "$S1" | jq '.headcountByMonth[-2].total')"
check "  at most five recent employees" "$([ "$(val '.recentEmployees|length')" -le 5 ] && echo yes)" yes
check "  newest first" "$(val '[.recentEmployees[].hireDate] == ([.recentEmployees[].hireDate]|sort|reverse)')" true
check "  the one hired today, entered last, comes first" "$(val '.recentEmployees[0].person.id')" "$E5"
check "  with name, email, department, province, date and status" "$(val '.recentEmployees[0]|[.person.firstName,.person.lastName,.email,.department,.province,.hireDate,.status]|join("|")')" "Newest|Hire|$T-5@x.com|$T-Dept|$T-North|$TODAY|ACTIVE"
check "  nothing but that is sent about a person" "$(val '.recentEmployees[0]|keys|join(",")') $(val '.recentEmployees[0].person|keys|join(",")')" "department,email,hireDate,person,province,status firstName,id,lastName,photoUrl"
check "  and no national ID or date of birth anywhere in the summary" "$(echo "$S" | grep -ci 'nationalId\|dateOfBirth')" 0
req DELETE /employee/$E5; expect "remove her again" 204

echo "--- CLEANUP: everything returns to the snapshot"
for e in $E1 $E3 $E4; do req DELETE /employee/$e; done
for t in $T1 $T2 $T3 $T4 $T5; do req DELETE /training/$t; done
req DELETE /location/$PA; req DELETE /location/$PB
req DELETE /department/$D; req DELETE /department/$D0
snap
check "  employees back to the start" "$(valc '.employees')" "$(echo "$S0" | jq -c '.employees')"
check "  leave back to the start" "$(valc '.leave')" "$(echo "$S0" | jq -c '.leave')"
check "  trainings back to the start" "$(valc '.trainings')" "$(echo "$S0" | jq -c '.trainings')"
check "  the monthly headcount back to the start" "$(valc '.headcountByMonth|map(.total)')" "$(echo "$S0" | jq -c '.headcountByMonth|map(.total)')"
check "  departments back to the start" "$(valc '.byDepartment|map({name,count})|sort_by(.name)')" "$(echo "$S0" | jq -c '.byDepartment|map({name,count})|sort_by(.name)')"
check "  provinces back to the start" "$(valc '.byProvince|map({name,count})|sort_by(.name)')" "$(echo "$S0" | jq -c '.byProvince|map({name,count})|sort_by(.name)')"

echo; echo "RESULT: $PASS passed, $FAIL failed"
