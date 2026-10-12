# SmartHR front end

React single-page app for the SmartHR API (see the README at the repository root).

| | |
|---|---|
| Build / dev server | Vite 8, TypeScript |
| UI | React 19, Tailwind CSS 4, lucide icons |
| Pages | React Router |
| Server data | TanStack Query (caching, loading / error states, refetch after changes) |
| HTTP | axios |

## Run

The API must be running first (`DATABASE_PASSWORD='...' ./mvnw spring-boot:run` in the repository root). Everything except the login
page needs an account: on its very first start the API prints an administrator username and password once in its log
(see the repository README, *Quick start* and *Security*).

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server must stay on port **5173** (it fails instead of picking another port): the API only accepts
requests from `localhost:5173` and `localhost:3000`. To call an API somewhere else, copy `.env.example` to
`.env.local` and set `VITE_API_URL`.

```bash
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build at http://localhost:4173 (the API allows that origin)
npm run lint
```

The app is static files: `dist/` can be served by any web server. The API has to allow the address it is served from
(`WebConfig.java` lists `localhost:5173`, `4173` and `3000`), and the front end finds the API through `VITE_API_URL`,
which is fixed when `npm run build` runs.

## Structure

```
src/
├── auth/
│   ├── AuthProvider.tsx    who is signed in (checks a stored token on page load, signs in, signs out)
│   ├── RequireAuth.tsx     everything below needs a login; a temporary password goes to "choose a new one" first
│   ├── RequireRole.tsx     shows a page only to some roles (everyone else sees "no access")
│   └── tokenStore.ts       the token lives in sessionStorage
├── api/
│   ├── client.ts        the axios instance: adds the token, turns every failure into an ApiError
│   │                    (status, message, per-field errors, code), and reacts to 401 / "change your password"
│   ├── types.ts         shapes returned by the API (BaseRecord, Department, Page<T>, ...)
│   └── auth.ts, users.ts, me.ts, audit.ts, departments.ts, employees.ts, leaves.ts, locations.ts, profiles.ts, trainings.ts
│                        one small function per endpoint
├── components/          Button, Modal (native <dialog>), ConfirmDialog, TextField / TextAreaField / SelectField,
│   │                    SortHeader, Badge, Pagination, LocationPicker (Province → Village dropdowns), Feedback, ToastProvider
│   ├── Layout, Logo, Hills, UserMenu, AuthShell     the app shell: dark side menu, top bar (search, bell, user menu), sign-in frame
│   ├── Panel, StatTile, Avatar, HillsBanner, BarList   the dashboard's building blocks
│   └── charts/          GrowthChart (line + table view), DonutChart (ring + legend)
├── hooks/               useAuth, useUrlParams (table state in the URL), useUrlSearchBox (a search box that follows the URL),
│                        useNewFromUrl (open the "new ..." form when the address has ?new=1), useToast, useDocumentTitle
├── lib/                 dates, location / leave / training / audit helpers (labels, colours), chart (palette, grouping), page sizes, shared styles
├── pages/
│   ├── auth/            LoginPage, ChangePasswordPage (forced after a temporary password, or from the menu)
│   ├── users/           UsersPage (administrators: create, edit, switch off, reset password, delete), UserForm, TemporaryPasswordDialog
│   ├── audit/           AuditPage (administrators: who did what and when, filters, before → after details)
│   ├── me/              MyProfilePage, MyLeavePage, MyTrainingsPage: what an employee sees of their own data
│   ├── dashboard/       DashboardPage (greeting, four tiles, growth line, department ring, recent hires, province bars, upcoming leave, quick actions, trainings)
│   ├── employees/       EmployeesPage (paged table, filters, sorting) and EmployeeForm (employee + profile)
│   ├── leaves/          LeavesPage (status tabs, filters, approve / reject) and LeaveForm
│   ├── trainings/       TrainingsPage (list), TrainingDetailPage (enrol / remove people) and TrainingForm
│   ├── departments/     DepartmentsPage and DepartmentForm
│   └── locations/       LocationsPage (browse one level at a time) and LocationForm; not in the menu, reached at /locations
├── App.tsx              routes
└── main.tsx             QueryClient + Router providers
```

## Conventions

- **One file per endpoint group in `api/`**, components never call axios directly.
- **The API is the only source of validation rules.** Forms use `noValidate` and show the API's `errors` object
  next to the matching input (this includes a duplicate email, phone, code or national ID); other failures (server down,
  a conflict that is not about one field) show as one message above the form.
- **After a change, invalidate the query** (`queryClient.invalidateQueries({ queryKey: ['departments'] })`) so the
  list refreshes itself.
- Lists that can grow use the API's `search-page` endpoints; `search-all` is for dropdowns.
- **The employees, leave and audit tables keep their whole state in the URL** (`?page=1&size=25&sortBy=hireDate&direction=desc&status=ACTIVE&q=uwa`),
  so refresh, a bookmark or a copied link show the same view. Filters and sorting change the URL with `replace`, so the
  back button leaves the page instead of stepping through every filter click.
- **Saving an employee is two API calls** when the profile section is filled in: create or update the profile, then the
  employee pointing at it. If the employee call fails after a brand-new profile was created, that profile is deleted
  again, so a retry is not refused with "national id already in use".
- **Approve / reject are confirmed and final.** The API refuses a second decision (409), so when somebody else decided a
  request first the dialog shows that message and the list reloads to show what really happened. Enrolling someone who was
  just enrolled elsewhere is handled the same way.
- A location is browsed one level at a time (`/locations`, `/locations/:id`). The API sends each location with its whole
  chain of parents, which is how the employee table and the picker know the full path without extra requests.
- `Modal` ignores a native `close` event that arrives after the dialog was opened again. Without that, closing a dialog
  and opening another one straight away could make the new one disappear.
- **Feedback after an action is a toast** (`useToast()`: "Department created", "Grace Mukamana's leave approved"). It is for
  success only. Errors stay inside the dialog or form that caused them, next to the field, so they cannot be missed or
  dismissed by accident.
- **The audit log page is read-only** (`/audit`, administrators only; HR does not see it in the menu and the route shows "no access").
  Filters are search text, username, action, kind of record and a date range, all in the URL. "History of this record" sets
  `entityId`, so the same page shows everything that ever happened to one employee, account or leave request, with a
  "Show everything" button to come back. A change shows as a small Field / Before / After table; national ID and date of birth
  are never sent by the API, so the page shows "not recorded" for them. Search boxes share `useUrlSearchBox`, which waits for a
  pause in typing before it changes the URL.
- **Every message shown to a user comes from the API**, which writes them for people ("Date of birth is required"). The front end
  never matches on message text; it reads `errors[field]` and shows it under that input.
- **The dashboard's numbers come from one call** (`GET /dashboard/summary`); only the trainings list is a second request. Nothing on it is
  made up: where the design called for something the system does not record (attendance, payroll, announcements) there is no tile, and a
  change figure ("↗ 4%") is shown only when there is an earlier number to compare with (otherwise it is left out, never shown as 0%).
  *Available today* means active staff who are not on approved leave; it is not an attendance count.
- **Charts follow the usual rules.** One series is one colour (the brand teal) from a zero baseline with a faint wash under the line, a dot per
  month and the latest value written at the end; hover or Tab to a month for its number; "Show table" gives the same numbers as a table.
  The department ring takes its colours from five fixed slots in a fixed order (`lib/chart.ts`, checked for colour-blind separation) and
  folds everything beyond the fifth department, plus people with no department, into one grey slice, so it never has more than six
  slices. Every slice is named in a legend with its number and share (the legend is the table view), and its row links to the
  employee list filtered the same way. The province bars are one colour with grey for "not assigned". There is no dark theme yet.
- **The theme lives in `src/index.css`** (`brand-*` teal, `navy-*` for the side menu, chart colours, card shadow); change a colour there, not in
  the pages. `brand-600` carries white text and `brand-700` is for links on white, both above 4.5:1.
- **The top bar search and the bell are real**: the search goes to `/employees?q=...` (only people who may see employees get it) and the bell
  shows how many leave requests are waiting (refreshed every minute and after any change to leave), linking to them. On a phone the menu
  slides over the page and closes on Escape, on a click outside it, or on choosing a page.
- **The quick actions open the real forms**: `/employees?new=1`, `/leaves?new=1`, `/trainings?new=1` and `/departments?new=1` start with the
  "new" dialog open (`useNewFromUrl`) and then remove the parameter, so a refresh does not open it again.
- Every page sets the browser tab title, and a "Skip to content" link is the first thing keyboard users reach.
- **Who is signed in** comes from `useAuth()` (`user`, `hasRole`, `signOut`). The menu and the routes are built from the role:
  HR and administrators get the management pages (administrators also *Accounts*); an employee gets *My profile / My leave / My trainings*;
  anybody with a linked employee record also gets the *Me* pages. A page the role may not see shows "no access", and the API refuses the
  request as well, so hiding a menu item is a courtesy, never the protection.
- **The token is in `sessionStorage`**: it survives a refresh and is gone when the tab closes. It is sent by an axios request interceptor.
  A 401 anywhere except the login request ends the session (the login page says "Your session has expired"), and signing out or
  expiring clears every cached query, so nothing one person loaded can show for the next.
- **A temporary password forces a change.** The API answers 403 with `code: PASSWORD_CHANGE_REQUIRED` to everything but `GET /me` and the
  password change, and `RequireAuth` sends the person to *Choose a new password* until it is done. Changing the password returns a new token.
- **A generated password is shown once**, in a dialog, when an account is created or reset; the server keeps only a hash. The person
  must be given it there and then.
- Self-service goes through `/me/**` with the same forms (`LeaveForm selfService`), which never send an employee id: the server files the
  request for the signed-in person.
