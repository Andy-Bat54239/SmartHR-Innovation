#!/bin/bash
# Runs every API test script and prints one line per suite. Exit code 1 if anything failed.
#   ./scripts/run-all.sh                      # against http://localhost:8082
#   API_BASE=http://localhost:9000 ./scripts/run-all.sh
# Every endpoint needs a login, so the suites sign in as the administrator:
#   ADMIN_PASSWORD='...' ./scripts/run-all.sh          (ADMIN_USER defaults to admin@smarthr.local)
cd "$(dirname "$0")" || exit 1
export API_BASE="${API_BASE:-http://localhost:8082}"

for tool in curl jq; do
  command -v $tool >/dev/null || { echo "'$tool' is required"; exit 1; }
done
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "ADMIN_PASSWORD is not set (the administrator's password). Run:  ADMIN_PASSWORD='...' ./scripts/run-all.sh"; exit 1
fi
if ! curl -s -m 5 -o /dev/null "$API_BASE/v3/api-docs"; then
  echo "API not reachable at $API_BASE. Start it first:  ./mvnw spring-boot:run"; exit 1
fi

status=0
for script in 0*.sh; do
  out=$(bash "$script" 2>&1)
  result=$(echo "$out" | grep '^RESULT:')
  printf '%-42s %s\n' "$script" "$result"
  if ! echo "$result" | grep -q ' 0 failed'; then
    status=1
    echo "$out" | grep -E '^FAIL|!!' | sed 's/^/    /'
  fi
done
exit $status
