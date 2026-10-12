# SmartHR

A human-resource management system for organisations in Rwanda: employees, departments, extended
profiles, leave requests, training enrolment, and Rwanda's administrative hierarchy
(Province → District → Sector → Cell → Village).

The repository holds the **REST API** (Spring Boot, this folder) and the **React front end** (`frontend/`,
see [frontend/README.md](frontend/README.md)). Front-end pages: **Dashboard**, **Employees**, **Leave requests**, **Trainings**, **Departments**, and for administrators **Accounts** and the **Audit log**.

| | |
|---|---|
| Language / build | Java 17+, Maven (wrapper included) |
| Framework | Spring Boot 4.1, Spring Web MVC, Spring Data JPA (Hibernate) |
| Database | PostgreSQL |
| Validation | Jakarta Bean Validation |
| API docs | springdoc OpenAPI (Swagger UI) |

---

## Quick start

1. **PostgreSQL** running on `localhost:5432`, then create the database once:

   ```bash
   createdb -U postgres smarthr_db
   ```

2. **Run the API.** The database password is read from `DATABASE_PASSWORD` (default `postgres`), so it is
   never written into the repository:

   ```bash
   DATABASE_PASSWORD='your-password' ./mvnw spring-boot:run
   ```

3. **The first administrator.** On the very first start (no accounts yet) the app creates one and prints its
   username and a generated password **once** in the log:

   ```
   First start: an administrator account was created.
     username: admin@smarthr.local
     password: ...
   ```

   Sign in with it; you are asked to choose your own password straight away. To pick the password yourself instead,
   start with `SMARTHR_ADMIN_PASSWORD='...'` (and optionally `SMARTHR_ADMIN_USERNAME`). Lost it? See
   [Forgotten administrator password](#forgotten-administrator-password).

4. Open **http://localhost:8082/swagger-ui.html**. Every endpoint except `POST /auth/login` needs a login: call
   `/auth/login`, copy the `token` from the answer, press **Authorize** and paste it.

5. *(optional)* Start the React app in a second terminal, at **http://localhost:5173**:

   ```bash
   cd frontend && npm install && npm run dev
   ```

Tables are created automatically (`spring.jpa.hibernate.ddl-auto=update`). On the very first start the app also
loads reference data (see [Seed data](#seed-data)).

Configuration lives in `src/main/resources/application.properties` (port `8082`, datasource, seeding on/off, [security](#security)).

## Seed data

On the first start, **only while the tables are empty**, `DataSeeder` loads:

- Rwanda's **5 provinces** (`KIG`, `NOR`, `SOU`, `EAS`, `WES`) and all **30 districts**
- the **35 sectors** of Kigali City (Gasabo, Kicukiro, Nyarugenge)
- **6 departments**: Human Resources, Finance, Information Technology, Operations, Marketing, Administration

Cells and villages (thousands of rows) are added through the API. Restarting never duplicates the data, and
anything you add or delete later is left alone. Switch it off with `smarthr.seed.enabled=false`.

---

## Security

Every endpoint except `POST /auth/login` needs a signed-in account. A login answers with a **token** that the client sends
as `Authorization: Bearer <token>`; it is valid for 8 hours. There is no session and no cookie.

| Role | May |
|---|---|
| **ADMIN** | everything HR can do, manage accounts (`/user`) and read the audit log (`/audit`) |
| **HR** | employees, profiles, departments, locations, trainings, leave requests (including approving them), the dashboard |
| **EMPLOYEE** | only their own profile, leave requests and trainings (`/me/**`) |

Any account that is linked to an employee (an EMPLOYEE account always is) can use `/me/**`, so an HR user can also ask for their own leave.

**How it is protected**

- Passwords are stored as BCrypt hashes, 8 to 72 characters, and never appear in any response. Usernames are email addresses, not case sensitive.
- **An administrator creates accounts** and never chooses the password: the server generates a temporary one, shows it once, and the
  person must replace it at the first sign-in. Until they do, the account can call nothing except `GET /me` and `POST /auth/change-password`
  (others answer 403 with `"code": "PASSWORD_CHANGE_REQUIRED"`). The same applies after an administrator resets a password.
- **Changes take effect at once.** The role, the on/off switch and the password version are read from the database on every request,
  not from the token. Switching an account off, resetting or changing its password, changing its role, or deleting it ends the
  old tokens immediately.
- **Lockout:** 5 wrong passwords in a row lock that username for 10 minutes (429 with a `Retry-After` header), counted for unknown
  usernames too, so the answer never reveals whether an account exists. A wrong username, a wrong password and a switched-off account
  all get the same "Incorrect username or password".
- **Nobody approves their own leave request.** The API answers 403; another HR user or an administrator must decide it.
- **Employees reach only their own data.** `/me/**` works from the account's linked employee, never from an id in the request; another
  person's leave request looks like one that does not exist (404).
- The last active administrator cannot be deleted, switched off or demoted; you cannot delete, demote or switch off your own
  account; deleting an employee also deletes their account, unless it is the last active administrator.
- The signing key comes from `SMARTHR_JWT_SECRET` (at least 32 characters). The built-in default is for your own machine only: the app
  starts with a warning when it is in use. Set a long random value anywhere else.

**Settings** (`application.properties`, or the environment variable in brackets)

| Property | Default | |
|---|---|---|
| `smarthr.security.jwt-secret` (`SMARTHR_JWT_SECRET`) | development value | signs the tokens; **change it outside your machine** |
| `smarthr.security.token-ttl` | `8h` | how long a login lasts |
| `smarthr.security.max-failed-logins` | `5` | wrong passwords before the lockout |
| `smarthr.security.lockout-duration` | `10m` | how long the lockout lasts |
| `smarthr.security.bootstrap-admin.username` (`SMARTHR_ADMIN_USERNAME`) | `admin@smarthr.local` | the first administrator |
| `smarthr.security.bootstrap-admin.password` (`SMARTHR_ADMIN_PASSWORD`) | generated and logged once | its password |

**Forgotten administrator password.** Any other administrator can reset it (Accounts page). If it was the only one, stop the app, run
`DELETE FROM app_user;` against `smarthr_db`, and start it again: a new administrator is created and its password is logged. (This removes
every account, so the others have to be created again.)

**Good to know**

- Use HTTPS anywhere but your own machine; tokens and passwords travel in every request.
- The lockout counter is kept in memory: it resets when the app restarts, and is per server.
- There are no refresh tokens or "remember me": after 8 hours, or a password change, people sign in again.
- Only the browser origins `localhost:5173`, `4173` and `3000` may call the API (`SecurityConfig.java`).
- The API docs (`/swagger-ui.html`, `/v3/api-docs`) are public; set `springdoc.api-docs.enabled=false` to hide them.

## Audit log

Every change to the data, and every sign-in, is written down: **who** (username and role), **what** (which record, with a
sentence such as "Changed employee Aline Uwase: Phone, Status"), **when**, **from where** (the address the request came from)
and, for a change, each field **before → after**. Only administrators can read it (Audit log in the menu, `GET /audit/search-page`).

| Recorded | Not recorded |
|---|---|
| creating, changing and deleting employees, profiles, departments, locations, trainings, leave requests and accounts | anything that only reads data |
| leave approved, rejected or withdrawn; someone enrolled in or removed from a training | a change that failed, or that changed nothing (it leaves no entry) |
| account created, switched off, given another role, deleted; password reset or changed | **passwords**, temporary passwords and hashes: never, anywhere |
| sign-ins, failed sign-ins (with the reason) and lockouts | **national ID and date of birth**: the entry says the field changed and shows "(hidden)" for both values |

- **It cannot be edited or deleted** through the API, and the database columns are not updatable. Nothing in the app writes to it except the
  service code that makes the change itself.
- **A change and its entry succeed or fail together**: they are saved in one transaction, so there is never a change without an entry, or an
  entry for something that was rolled back. (Sign-in entries are saved on their own, because a failed sign-in has no change to go with.)
- **Entries outlive what they describe.** They keep the username, the name of the record and its old values as text, so deleting an account or an
  employee does not blank the history. Deleting an employee is one entry that says what went with it ("Also removed: their profile, 2 leave requests").
- **Who did it** is the signed-in account; the first administrator created at start-up is recorded as `system`.

`GET /audit/search-page`: `page`, `size` (default 25, at most 100), `sortBy` (`occurredAt` (default, newest first), `action`, `entityType`, `actorUsername`),
`direction`, and these filters, combined with AND:

| Parameter | Matches |
|---|---|
| `q` | text in the summary, the record's name or the note (ignores case) |
| `action` | one action, e.g. `LEAVE_APPROVED`, `ACCOUNT_DELETED`, `SIGN_IN_FAILED` |
| `entityType` | `EMPLOYEE`, `PROFILE`, `DEPARTMENT`, `LOCATION`, `TRAINING`, `LEAVE_REQUEST` or `ACCOUNT` |
| `entityId` | the history of one record (the "History of this record" link) |
| `actor` | part of the username of whoever did it |
| `from`, `to` | first and last day, inclusive (`2026-03-01`), in the server's time zone |

**Limits to know about**

- Failed sign-ins are recorded at most 60 a minute, so a flood of guesses cannot fill the table; the lockout itself is unaffected.
- The address is what the server sees (`remoteAddr`). Behind a reverse proxy it is the proxy's address unless the proxy is set up to forward the real one.
- The log only grows. To prune it, delete old rows in the database (`audit_event`, and its child table `audit_event_change`).
- Changes made directly in the database, or by the seed data at first start, are not in it.

## Sign in with Google

"Continue with Google" uses the OAuth2 / OpenID Connect **authorization code flow**, run by Spring Security's OAuth2 client. SmartHR never sees the Google password.

```
browser ─► GET /oauth2/authorization/google ─► Google (the person signs in there)
Google  ─► GET /login/oauth2/code/google?code=… ─► SmartHR exchanges the code for an ID token and checks it (signature, state, nonce)
SmartHR ─► redirect to the web app: /auth/google/callback?code=<one-time code>     (or ?error=<reason>)
web app ─► POST /auth/google/exchange {"code"} ─► the usual login (or a two-factor challenge)
```

**Rules.** Google only proves who somebody is; SmartHR still decides.
- **No account is ever created** from Google. An administrator creates the account first, and its username must be the person's Google email address. Case does not matter.
- The email must be **verified by Google**.
- A **switched-off** account is refused.
- An account that still has a **temporary password** is refused until the person has chosen their own (otherwise Google would sidestep that step).
- An account with **two-factor sign-in** still has to enter its code after Google (and an administrator who has not set it up still gets only the Security page).
- Failed attempts and successful ones are in the audit log ("Signed in with Google").
- The token never appears in the address bar: the redirect carries a **one-time code** that works once, for 60 seconds, and is swapped for the login with one POST.

**Set it up (once)**
1. Open the [Google Cloud console](https://console.cloud.google.com/), create or choose a project, then **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email, and (while the app is in *Testing*) add the Google accounts that may sign in under **Test users**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**. Under **Authorised redirect URIs** add exactly
   `http://localhost:8082/login/oauth2/code/google` (for another address, `https://<your-api>/login/oauth2/code/google`). Authorised JavaScript origins are not needed.
3. Copy the **Client ID** and **Client secret** and give them to the app as environment variables (never commit the secret):
   `GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… ./mvnw spring-boot:run` (in IntelliJ: *Run → Edit configurations → Environment variables*).
4. Restart the API. The **Continue with Google** button appears on the login page. Without both values the button is hidden and nothing else changes.

| Setting (environment variable) | |
|---|---|
| `smarthr.google.client-id` (`GOOGLE_CLIENT_ID`), `smarthr.google.client-secret` (`GOOGLE_CLIENT_SECRET`) | the OAuth client from step 3 |
| `smarthr.google.frontend-url` (`SMARTHR_APP_URL`) | the address of the web app, where the browser is sent back to (default `http://localhost:5173`) |

**Good to know.** The Google flow keeps a short session cookie (it holds the OAuth "state" while the person is at Google); the rest of the API stays stateless.
Behind a reverse proxy, forward the original host and scheme, so the redirect URI Spring builds matches the one registered with Google.
`GoogleSignInTest` checks the redirect to Google and every rule above without calling Google (`createdb smarthr_test`, then `./mvnw test -Dtest=GoogleSignInTest`).

## Two-factor sign-in

Besides the password, an account can ask for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…): TOTP, RFC 6238,
30-second codes, no third-party service. **Administrators must use it; HR and employees may.**

- **Set it up** on the **Security** page (user menu): scan the QR code (or type the key), then enter the first code. That turns it on and shows **10 recovery
  codes**, once. Each recovery code signs in once if the phone is lost.
- **An administrator who has not set it up yet** can sign in but can do nothing else (403 with `"code": "TWO_FACTOR_SETUP_REQUIRED"`, except `GET /me`,
  `POST /auth/change-password` and `/auth/2fa/**`); the app takes them to the Security page.
- **Signing in has two steps.** `POST /auth/login` answers `{"twoFactorRequired": true, "challengeToken": "..."}` instead of a token, and
  `POST /auth/login/2fa` with `{"challengeToken","code"}` (a current code or an unused recovery code) answers with the token. The challenge lasts 5 minutes, cannot be
  used as a login token, and a login token cannot be used as a challenge. A code works once (replays are refused), and wrong codes count towards the same lockout as wrong passwords.
- **Turning it off or making new recovery codes** needs the password and a current code. Administrators cannot turn it off.
- **Lost phone:** an administrator uses **Reset 2FA** on the Accounts page (`POST /user/{id}/reset-two-factor`); the person is signed out everywhere and signs in with the
  password alone (an administrator must then set it up again). Nobody can reset their own; a second administrator is needed for that, so keep recovery codes safe.
- Every change is in the audit log (as account updates) and the person gets a security email.

| Method | Path | |
|---|---|---|
| GET | `/auth/2fa` | `{"enabled","required","recoveryCodesLeft"}` |
| POST | `/auth/2fa/setup` | `{"secret","otpauthUri"}`; a new secret, not active until enabled (409 when already on) |
| POST | `/auth/2fa/enable` | `{"code"}` → `{"recoveryCodes":[...]}`, shown once |
| POST | `/auth/2fa/disable` | `{"password","code"}` → 204; 409 for administrators |
| POST | `/auth/2fa/recovery-codes` | `{"password","code"}` → new `{"recoveryCodes":[...]}` |

**Good to know.** The authenticator secret is stored as is in `app_user.totp_secret` (only the recovery codes are hashed): protect the database like you protect the signing key.
`TwoFactorFlowTest` walks through all of this against a scratch database (`createdb smarthr_test`, then `./mvnw test -Dtest=TwoFactorFlowTest`); it refuses to run against any other.

## Email notifications

SmartHR sends these emails, in the background and only after the change is saved:

| Email | To |
|---|---|
| A leave request is waiting | every active HR and administrator account (not the person who filed it) |
| Your leave was approved / rejected (with the reason) | the employee |
| You were enrolled in a training | the employee |
| A training starts tomorrow (every morning at 07:00 server time; `smarthr.mail.reminder-days-before`) | the people enrolled |
| Password changed or reset, two-factor turned on, off or reset, a recovery code used | the account itself, **always** |

Leave and training emails go to employees' addresses and need an account; each person can switch them off on the Security page (security alerts stay on).
Nothing is sent until you give an SMTP server (otherwise each email is only written to the log, so development works without one):

| Setting (environment variable) | |
|---|---|
| `spring.mail.host` (`SMTP_HOST`), `spring.mail.port` (`SMTP_PORT`, 587), `spring.mail.username` (`SMTP_USERNAME`), `spring.mail.password` (`SMTP_PASSWORD`) | the SMTP server (STARTTLS) |
| `smarthr.mail.from` (`SMTP_FROM`) | the sender, e.g. `SmartHR <hr@yourcompany.com>` |
| `smarthr.mail.app-url` (`SMARTHR_APP_URL`) | the address of the web app, used for the buttons in the emails (default `http://localhost:5173`) |
| `smarthr.mail.enabled` | `false` switches all email off |

A failed send never fails the request that caused it. Emails travel through RabbitMQ, which is what retries them: see below.

### RabbitMQ: how emails are queued and retried

Emails are not sent by the request that causes them. They are put on a RabbitMQ queue, and a consumer inside the app sends them, so an email survives a restart
and is retried when the mail server is down.

```
change saved ──► NotificationListener ──► exchange smarthr.notifications ──► queue smarthr.email ──► EmailConsumer ──► SMTP
                                                                                  │  rejected after the last retry
                                                                                  ▼
                                          exchange smarthr.notifications.dead ──► queue smarthr.email.dead  (kept for an administrator)
```

- **Start the broker:** `docker compose up -d` (RabbitMQ 4 with its management console at <http://localhost:15672>, user and password `guest`). The queues and exchanges are created by the
  app when it connects; there is nothing to set up by hand. Settings: `spring.rabbitmq.host/port/username/password` (`RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`).
  The `guest` user only works from the same machine: create your own user for anything else.
- **Retries:** a failed send is tried again after 5 s, 15 s, 45 s and 2 min (5 attempts in all; `spring.rabbitmq.listener.simple.retry.*`). Then the email goes to the dead-letter queue and stays there.
- **Administrators** can see the queue and put dead emails back (they get a fresh set of retries): `GET /notification/email-queue` answers
  `{"available","waiting","consumers","dead"}`, and `POST /notification/email-queue/retry-dead` answers `{"requeued": n}`.
- **Messages are JSON** and **persistent** (they survive a broker restart); the queue is durable.
- **If RabbitMQ is down** when an email is due, the app sends it directly, once and without retries, and logs a warning, so a stopped broker never silently loses a notification.
  Emails already on the queue wait there until the app and the broker are both running.
- **The queue names** start with `smarthr`; `smarthr.queue.prefix` changes that (the tests use their own, so they never touch a running app's queues).
- **Not queued, on purpose:** the audit trail. It is written in the same database transaction as the change, so a change and its entry succeed or fail together.
- `EmailQueueTest` checks delivery, retry until success, and dead-lettering plus retry against a real broker (`docker compose up -d`, `createdb smarthr_test`); it is skipped when no broker answers.

## Leave balance

Each employee has a yearly allowance of **working days** (Monday to Friday; public holidays are not taken off) for each kind of leave.
Set the allowances in `application.properties`; the values shipped are starting points, not legal advice:

| Property | Default | |
|---|---|---|
| `smarthr.leave.annual-days` | `18` | annual leave per calendar year |
| `smarthr.leave.sick-days` | `15` | sick leave per calendar year |

Unpaid leave has no limit. A balance is `allowance - approved - pending`: a request that is waiting for a decision already holds its days, so the same
days cannot be asked for twice, and a rejected or withdrawn request gives them back. A request that spans two years is counted in each year. Submitting
or editing a request that needs more days than are left is refused with a 400 on `type` (HR filing it for someone else included). Approving
never fails for this reason, because the days were already held.

`GET /me/leave/balance` (the signed-in person) and `GET /leave/employee/{employeeId}/balance` (HR and administrators) answer with, per type:
`{"type","year","allowance","approved","pending","remaining"}`; `allowance` and `remaining` are `null` for a type without a limit.
The React app shows it as cards on **My leave** and as a hint in the leave form before you submit.

## API reference

All ids are UUIDs, dates are ISO (`2026-03-01`), bodies are JSON, and every call except login carries the
`Authorization: Bearer <token>` header (see [Security](#security) for who may call what). Errors follow one [format](#errors-and-validation).
Routes follow the course template: `POST /<entity>/create`, `PUT|DELETE /<entity>/{id}`, `GET /<entity>/search-all`,
`GET /<entity>/search/{id}`.

### Sign-in: `/auth`
| Method | Path | |
|---|---|---|
| POST | `/login` | `{"username","password"}` → `{"token","expiresAt","user"}`; the only public endpoint |
| POST | `/change-password` | `{"currentPassword","newPassword"}` → a new login (every earlier token stops working). A wrong current password is a 400 on `currentPassword`, not a 401 |

### Accounts: `/user` (ADMIN only)
| Method | Path | |
|---|---|---|
| POST | `/create` | `{"username","role","employeeId"}` → `{"user","temporaryPassword"}`; the password is shown this once. `employeeId` is required for EMPLOYEE, optional otherwise, and one employee has at most one account |
| GET | `/search-all`, `/search/{id}` | accounts (never their passwords) |
| PUT | `/{id}` | `{"role","enabled","employeeId"}`; not your own role or on/off switch |
| POST | `/{id}/reset-password` | new temporary password, shown once; the person is signed out everywhere |
| DELETE | `/{id}` | not your own account, not the last active administrator |

### Self-service: `/me` (any signed-in account)
| Method | Path | |
|---|---|---|
| GET | `/me` | the account and its employee record (allowed even while a password change is pending) |
| GET | `/me/leave` | my leave requests, newest first |
| POST | `/me/leave` | ask for leave; filed for me whatever the body says |
| PUT | `/me/leave/{id}` | change my request while it is pending (404 if it is not mine, 409 once decided) |
| DELETE | `/me/leave/{id}` | withdraw my request, only while pending |
| GET | `/me/trainings` | the trainings I am enrolled in |

An account that is not linked to an employee gets 409 from the `/me/leave` and `/me/trainings` endpoints.

### Department: `/department`
| Method | Path | |
|---|---|---|
| POST | `/create` | name and code must be unique |
| PUT | `/{id}` | |
| DELETE | `/{id}` | employees are kept, their department becomes empty |
| GET | `/search-all`, `/search/{id}` | |

### Employee: `/employee`
| Method | Path | |
|---|---|---|
| POST | `/create` | may reference a department, location and profile by id |
| PUT | `/{id}` | a missing `profile` leaves the profile unchanged |
| DELETE | `/{id}` | also deletes the profile, leave requests and enrolments |
| GET | `/search-all` | every employee, unpaged (dropdowns) |
| GET | `/search-page` | paged, sorted and filterable, see [Pagination and sorting](#pagination-and-sorting) |
| GET | `/search/{id}` | |
| GET | `/department/{departmentId}` | paged |
| GET | `/status/{ACTIVE\|INACTIVE}`, `/gender/{MALE\|FEMALE\|OTHER}` | |
| GET | `/province/{provinceId}`, `/province/code/{code}`, `/province/name/{name}` | everyone living anywhere inside that province |
| GET | `/{id}/province` | the employee's province |
| GET | `/{id}/location` | path `[Province, District, Sector, Cell, Village]` |

### Employee profile: `/employee-profile`
`POST /create`, `PUT /{id}`, `DELETE /{id}`, `GET /search-all`, `GET /search/{id}`. A profile is created on its own,
then attached by sending `"profile": {"id": "..."}` when creating or updating the employee. One profile belongs to
at most one employee.

### Location: `/location`
| Method | Path | |
|---|---|---|
| POST | `/create` | `type` is required. Anything but a `PROVINCE` needs `"parent": {"id": "..."}` exactly one level up |
| PUT | `/{id}` | only `name` and `code` change; type and parent are fixed |
| DELETE | `/{id}` | removes the whole subtree; employees there keep existing with no location |
| GET | `/search-all`, `/search/{id}` | |
| GET | `/type/{PROVINCE\|DISTRICT\|SECTOR\|CELL\|VILLAGE}` | |
| GET | `/{id}/children` | direct children |

### Training: `/training`
| Method | Path | |
|---|---|---|
| POST | `/create` | title must be unique, `endDate` not before `startDate` |
| PUT / DELETE | `/{id}` | deleting un-enrols everyone first |
| GET | `/search-all`, `/search/{id}`, `/search?title=` | title search ignores case |
| POST | `/{trainingId}/assign/{employeeId}` | enrol (409 if already enrolled) |
| DELETE | `/{trainingId}/remove/{employeeId}` | un-enrol (404 if not enrolled) |
| GET | `/employee/{employeeId}` | an employee's trainings |
| GET | `/{trainingId}/employees` | who is enrolled |

### Leave requests: `/leave`
| Method | Path | |
|---|---|---|
| POST | `/create` | needs `"employee": {"id": "..."}`; always starts `PENDING` |
| PUT | `/{id}` | only while `PENDING`; dates, reason, type |
| GET | `/employee/{employeeId}/balance` | `?year=` (default this year): one balance per kind of leave, see [Leave balance](#leave-balance) |
| PATCH | `/{id}/approve` | only a `PENDING` request; a decision is final (409 after) |
| PATCH | `/{id}/reject` | body `{"reason"}` is **required** (not blank, at most 1000 characters; 400 on `reason` otherwise). Same rules as approve. The reason is stored as `rejectionReason`, shown to the employee, and written to the audit entry's note |
| DELETE | `/{id}` | |
| GET | `/search-all`, `/search/{id}` | |
| GET | `/search-page` | paged, sorted and filterable, see [Pagination and sorting](#pagination-and-sorting) |
| GET | `/employee/{employeeId}`, `/employee/{employeeId}/page` | one employee's requests |
| GET | `/status/{PENDING\|APPROVED\|REJECTED}`, `/type/{ANNUAL\|SICK\|UNPAID}` | |

### Audit log: `/audit` (ADMIN only)
| Method | Path | |
|---|---|---|
| GET | `/search-page` | paged, sorted and filterable, see [Audit log](#audit-log). There is nothing else: entries cannot be added, changed or deleted |

### Dashboard: `/dashboard`
| Method | Path | |
|---|---|---|
| GET | `/summary` | everything the dashboard shows, computed on the server in one call |

```json
{ "employees":   { "total": 12, "active": 10, "inactive": 2, "availableToday": 8 },
  "byDepartment": [ { "id": "...", "name": "Information Technology", "count": 4 }, ..., { "id": null, "name": "No department", "count": 1 } ],
  "byProvince":   [ { "id": "...", "name": "Kigali City", "count": 6 }, ..., { "id": null, "name": "No location", "count": 2 } ],
  "leave":        { "pending": 3, "onLeaveToday": 2, "onLeaveLastWeek": 1 },
  "trainings":    { "ongoing": 1, "upcoming": 2, "completed": 1, "unscheduled": 0 },
  "headcountByMonth": [ { "month": "2026-05", "total": 8 }, ..., { "month": "2026-10", "total": 12 } ],
  "upcomingLeave": [ { "id": "...", "employee": { "id": "...", "firstName": "Aline", "lastName": "Uwimana", "photoUrl": null },
                       "type": "ANNUAL", "startDate": "2026-10-01", "endDate": "2026-10-05" } ],
  "recentEmployees": [ { "person": { "id": "...", "firstName": "...", "lastName": "...", "photoUrl": null }, "email": "...",
                         "department": "Finance", "province": "Kigali City", "hireDate": "2026-09-28", "status": "ACTIVE" } ] }
```

Every department and every province is listed (an empty one has `count: 0`), biggest first. An employee placed at any level
of the location tree (village, cell, sector or district) is counted under its province. The "nobody assigned" group comes
last, has `id: null`, and appears only when it is not empty.

- `onLeaveToday` counts **people** with an approved request covering today (two overlapping requests of one person are one);
  `onLeaveLastWeek` is the same count for this day a week ago. `availableToday` is the active staff minus those on leave.
- `headcountByMonth` has the last six months, oldest first: everyone hired on or before the end of that month (the current month: up to
  today). The system does not record when someone leaves, so an employee who is now inactive is still counted.
- `upcomingLeave`: approved leave that is under way or still to come, soonest first, at most five. `recentEmployees`: the newest hires,
  at most five. Both carry only what is needed to show a name and a picture, never a national ID or a date of birth.

### Example: a complete employee

```bash
B=http://localhost:8082
# 0. sign in (as an HR user or an administrator) and keep the token
TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"you@example.com","password":"your-password"}' | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"
# 1. an extended profile
curl -X POST $B/employee-profile/create -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "nationalId":"1199880012345678","dateOfBirth":"1995-05-05","educationLevel":"Bachelor"}'
# 2. the employee, referencing existing rows by id (ids come from the earlier responses / search-all)
curl -X POST $B/employee/create -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "firstName":"Alice","lastName":"Uwimana","email":"alice@example.com","phone":"+250788123456",
  "gender":"FEMALE","status":"ACTIVE","hireDate":"2024-01-15",
  "department":{"id":"<department id>"},"location":{"id":"<village id>"},"profile":{"id":"<profile id>"}}'
```

---

## Errors and validation

Every error has the same shape:

```json
{ "timestamp": "...", "status": 400, "error": "Bad Request", "message": "Validation failed",
  "errors": { "email": "Email must be a well-formed email address", "phone": "Phone must be a Rwandan mobile number like +250788123456 or 0788123456" },
  "path": "/employee/create" }
```

`errors` (one entry per broken field, all reported at once) appears whenever a problem belongs to one input, so a form can
show it next to that input: failed validation, a 409 such as `{"errors": {"email": "Email already in use: ..."}}`, and a
400 such as an end date before the start date (`{"errors": {"endDate": "End date cannot be before start date"}}`) or a
location placed under the wrong level (`{"errors": {"parent": "A cell must be inside a sector, not a district"}}`).
The keys are the JSON field names; the messages are written for people ("Date of birth is required").
Conflicts that are not about one field (already enrolled, profile already linked) and 400s about the request itself (a page
size out of range) have no `errors`.

| Status | When |
|---|---|
| 400 | validation failed, unreadable JSON or unknown enum value, bad id or page parameter, wrong location level, end before start, value too long |
| 401 | no token, an expired or invalidated token, wrong username or password |
| 403 | signed in but not allowed (wrong role, deciding your own leave request), or a password change is pending (`code: PASSWORD_CHANGE_REQUIRED`) |
| 404 | record, parent, department or location not found; unknown route |
| 405 | wrong HTTP method |
| 429 | too many wrong passwords; `Retry-After` says how many seconds to wait |
| 409 | duplicate email / phone / code / title / national id, profile already linked, already enrolled, leave request already decided |

**Rules**

| Field | Rule |
|---|---|
| Employee `firstName`, `lastName` | required, max 50 |
| Employee `email` | required, valid address, max 150, unique |
| Employee `phone` | required, Rwandan mobile: `+250` or `0`, then `72`/`73`/`78`/`79`, then 7 digits; unique |
| Employee `gender`, `status`, `hireDate` | required; `hireDate` not in the future |
| Profile `nationalId` | required, exactly 16 digits, unique |
| Profile `dateOfBirth` | required, in the past |
| Profile `educationLevel` | required, max 100 |
| Department `name` / `code` | required; max 100 / 20; code = letters, digits, `-`, `_`; both unique |
| Location `name`, `type` | required; `code` max 10 and unique when given |
| Training `title` | required, max 200, unique |
| Leave `startDate`, `endDate`, `type` | required; `reason` max 1000; `employee` required when submitting (not on update) |

Only the top-level body is validated: a reference such as `"department": {"id": "..."}` carries just the id.
`PUT` replaces the record, so send all required fields.

## Pagination and sorting

`GET .../search-page?page=0&size=10&sortBy=lastName&direction=asc`

- `page` starts at 0, `size` is 1–100, `direction` is `asc` or `desc`.
- Sortable fields: employees `id, firstName, lastName, email, hireDate, status, gender, createdAt`; leave
  requests `id, startDate, endDate, status, type, createdAt`; audit entries `occurredAt, action, entityType, actorUsername`. Anything else is a 400.
- Response: `{ "content": [ ... ], "page": { "size", "number", "totalElements", "totalPages" } }`.
- A page past the end is `200` with empty `content`.

`GET /employee/search-page` also takes optional filters, which combine with AND:

| Parameter | Matches |
|---|---|
| `q` | text in the first name, last name, full name, email or phone (ignores case; `%` and `_` are literal) |
| `status` | `ACTIVE` or `INACTIVE` |
| `gender` | `MALE`, `FEMALE` or `OTHER` |
| `departmentId` | employees of that department (404 if it does not exist) |
| `provinceId` | employees living anywhere inside that province (404 unknown, 400 if not a province) |

Example: `/employee/search-page?provinceId=<id>&status=ACTIVE&q=uwa&sortBy=hireDate&direction=desc&size=25`.

`GET /leave/search-page` takes optional filters too, also combined with AND:

| Parameter | Matches |
|---|---|
| `status` | `PENDING`, `APPROVED` or `REJECTED` |
| `type` | `ANNUAL`, `SICK` or `UNPAID` |
| `employeeId` | that employee's requests (404 if the employee does not exist) |

Example: `/leave/search-page?status=PENDING&type=SICK&sortBy=startDate&direction=desc`.

---

## Project layout

Structure and style follow the course template (`StockManagementSystemSpringV2`): one package per feature with
`domain`, `repository` and `service` (interface + `Impl`), controllers together, UUID ids from a shared `BaseEntity`.

```
src/main/java/rw/ac/auca/
├── smarthr/SmartHrApplication.java      entry point (scans rw.ac.auca)
├── base/                                BaseEntity (id, createdAt, updatedAt), PageRequests, OnCreate
├── config/                              WebConfig (stable page JSON), OpenApiConfig (Swagger "Authorize")
├── controller/                          one @RestController per entity
├── department/  employee/  employee_profile/  leave_request/  location/  training/  user/  audit/
│   └── domain, repository, service   (user/ and audit/ also have dto/; the account shapes never hold a password)
├── security/                            SecurityConfig (who may call what, CORS), tokens, lockout, first admin
├── dashboard/service/                   DashboardService + the summary records
├── exception/                           404 / 409 / field-level 400 exceptions + GlobalExceptionHandler
└── seed/DataSeeder.java                 first-start reference data
frontend/                                React app (Vite + TypeScript)
scripts/                                 API tests (curl + jq)
```

**Relationships:** Department 1–* Employee · Employee 1–1 EmployeeProfile (employee owns the FK) ·
Employee 1–* LeaveRequest · Employee *–* Training (join table `employee_trainings`, employee is the owning side) ·
Employee *–1 Location · Location 1–* Location (self-reference, one table for all five levels).

## Tests

`scripts/` holds black-box API tests (curl + jq) that create data, check the responses and delete it again.
Every endpoint needs a login, so the suites sign in as the administrator: give its password in `ADMIN_PASSWORD` (`ADMIN_USER`
defaults to `admin@smarthr.local`; the account must already have chosen its own password and, because administrators must use
[two-factor sign-in](#two-factor-sign-in), set it up: give the Base32 key from the Security page in `ADMIN_TOTP_SECRET` and the scripts work out the
codes themselves, which needs `python3`). Start the API, then:

```bash
ADMIN_PASSWORD='...' ADMIN_TOTP_SECRET='ABCD EFGH ...' ./scripts/run-all.sh      # 667 checks across six suites; exit code 1 if any fail
```

| Script | Covers |
|---|---|
| `01-crud-and-relationships.sh` | CRUD for all entities, links between them, 404/409/400 cases, safe deletes |
| `02-province-lookups-and-paging.sh` | employees by province, location path, paging, sorting, every employee and leave search filter and their combinations |
| `03-validation-and-seed-data.sh` | every validation rule and message, which field each duplicate or bad-input error names, the seed data |
| `04-dashboard.sh` | the dashboard summary: exact counts by department and province (roll-up from any level), unassigned groups, leave today (people, not requests) and availability, trainings by phase, the six-month headcount series, upcoming leave, the newest hires, live updates |
| `05-security.sh` | rejected, forged and unsigned tokens; login and lockout; the forced first-login password change; what each role may call across every endpoint group; self-service limits; nobody approving their own leave; switch-off / reset / role change / delete taking effect at once; account safety rules. It creates its own test accounts with random passwords and removes them |
| `06-audit.sh` | an entry for every kind of change, with who / what / when / from where and the before → after values; nothing for a failed, rolled-back or unchanged request; national ID, date of birth and passwords nowhere in it; sign-ins, failed sign-ins and lockouts; entries that outlive deleted accounts and records; administrators only and read-only; every filter, the sorting and the paging. Its entries stay in the log, by design |

Point them elsewhere with `API_BASE=http://host:port`. They need `curl`, `jq` and (for the security suite) `openssl`. Each suite checks its figures as changes against the
data already there, so it also works on a database that is not empty.

## Working with Git

- **Branches:** `main` always holds working, reviewed code. Do each piece of work on its own branch, named by what it is:
  `feature/<name>`, `fix/<name>` or `docs/<name>` (for example `feature/mongodb-documents`), and open a pull / merge request into `main` when it is done.
- **Commits:** small, one idea each, with a message that says what and why, in the form `type(area): summary`
  (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`). Example: `feat(leave): refuse a request longer than the balance`.
- **Never commit secrets.** Passwords, the Gmail app password and the Google client secret live in `config/application.properties`
  (ignored by Git; start from `config/application.properties.example`) or in environment variables. Check `git status` before a commit.
- **Start:** `git clone <url>`, copy the example config as above, `docker compose up -d` (RabbitMQ), then `./mvnw spring-boot:run` and `cd frontend && npm install && npm run dev`.

## Notes

- `SmartHR_Documentation.docx` describes the earlier midterm version of the API (numeric ids, `/api/...` routes).
  This project keeps its features but follows the template's conventions, so ids and routes differ from that document.
- Not covered by the suites: the "last active administrator" rule through employee deletion (it needs every other administrator switched off, which
  would lock out the real one if a run were interrupted). It was checked once by hand.
