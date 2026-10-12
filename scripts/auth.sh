# Sourced by every test suite, after it has set $B (the API address).
# Signs in as the administrator and sets $TOKEN and $AUTH (the Authorization header).
#   ADMIN_PASSWORD  required: the administrator's password
#   ADMIN_USER      optional: defaults to admin@smarthr.local
#   ADMIN_TOTP_SECRET  needed once the administrator has set up two-factor sign-in (it is required for administrators): the
#                      Base32 key shown under the QR code on the Security page. A fresh code is worked out from it for every login.
ADMIN_USER="${ADMIN_USER:-admin@smarthr.local}"
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "ADMIN_PASSWORD is not set. Every endpoint needs a login now, so the tests sign in as the administrator:"
  echo "  ADMIN_PASSWORD='...' ./scripts/run-all.sh"
  exit 1
fi
_LOGIN=$(curl -s -m 10 -X POST -H 'Content-Type: application/json' \
  -d "$(jq -nc --arg u "$ADMIN_USER" --arg p "$ADMIN_PASSWORD" '{username:$u,password:$p}')" "$B/auth/login")
if [ "$(echo "$_LOGIN" | jq -r '.twoFactorRequired // false')" = "true" ]; then
  if [ -z "$ADMIN_TOTP_SECRET" ]; then
    echo "$ADMIN_USER uses two-factor sign-in. Give the Base32 key from the Security page in ADMIN_TOTP_SECRET."
    exit 1
  fi
  _CHALLENGE=$(echo "$_LOGIN" | jq -r '.challengeToken')
  # a code works once, so right after another suite used this step the server refuses it: wait for the next one
  for _try in 1 2 3 4; do
    _CODE=$(python3 - "$ADMIN_TOTP_SECRET" <<'PY'
import base64, hashlib, hmac, struct, sys, time
key = base64.b32decode(sys.argv[1].replace(" ", "").upper() + "=" * (-len(sys.argv[1].replace(" ", "")) % 8))
digest = hmac.new(key, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
offset = digest[-1] & 15
print("%06d" % ((struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000))
PY
)
    _LOGIN=$(curl -s -m 10 -X POST -H 'Content-Type: application/json' \
      -d "$(jq -nc --arg t "$_CHALLENGE" --arg c "$_CODE" '{challengeToken:$t,code:$c}')" "$B/auth/login/2fa")
    [ -n "$(echo "$_LOGIN" | jq -r '.token // empty')" ] && break
    sleep 10
  done
fi
TOKEN=$(echo "$_LOGIN" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  echo "Could not sign in as $ADMIN_USER: $(echo "$_LOGIN" | jq -r '.message // "no answer from the API"')"
  exit 1
fi
if [ "$(echo "$_LOGIN" | jq -r '.user.mustChangePassword')" = "true" ]; then
  echo "$ADMIN_USER has to choose a new password before it can be used: sign in once in the app (or POST /auth/change-password)."
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
