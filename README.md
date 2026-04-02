# 🔐 Auth Backend

A production-ready REST API built with **Node.js + Express + MongoDB** featuring stateful JWT authentication with refresh token rotation, reuse detection, and session management.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM modules) |
| Framework | Express v5 |
| Database | MongoDB via Mongoose |
| Authentication | JWT (jsonwebtoken) |
| Validation | Zod |
| Password Hashing | Node.js built-in `crypto` (PBKDF2 + SHA-512) |
| Token Hashing | Node.js built-in `crypto` (SHA-256) |
| Cookie Parsing | cookie-parser |
| Logging | morgan (dev) |

---

## 📁 Folder Structure

```
backend-4/
├── server.js                        # Entry point — connects DB, starts server
├── package.json
├── .env                             # Environment variables (never commit this)
│
└── src/
    ├── app.js                       # Express app setup — registers middleware & routes
    │
    ├── configs/
    │   ├── env.js                   # Loads & validates environment variables
    │   └── db.js                    # MongoDB connection logic
    │
    ├── models/
    │   ├── user.model.js            # User schema (name, email, hashed password, salt)
    │   └── session.model.js         # Session schema (userId, refreshToken hash, isRevoked, TTL)
    │
    ├── daos/                        # Data Access Objects — all direct DB queries live here
    │   └── user.dao.js
    │
    ├── dtos/                        # Data Transfer Objects — sanitise raw request body
    │   └── user.dto.js
    │
    ├── validations/                 # Zod schemas for request validation
    │   └── user.validation.js
    │
    ├── services/                    # Business logic — orchestrates DAOs and token logic
    │   └── user.service.js
    │
    ├── controllers/                 # HTTP layer — reads req, calls service, writes res
    │   └── user.controller.js
    │
    ├── middleware/
    │   ├── auth.middleware.js        # `protect` — verifies access token + session
    │   ├── validation.middleware.js  # `validate(schema)` — runs Zod validation
    │   └── errorHandling.middleware.js # Global error handler
    │
    ├── routes/
    │   └── user.route.js            # All route definitions
    │
    └── utils/
        ├── appError.js              # Custom operational error class
        ├── asyncWrapper.js          # Wraps async controllers to forward errors to next()
        └── auth.js                  # JWT sign/verify + SHA-256 token hashing
```

---

## ⚙️ Setup Instructions

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd backend-4
npm install
```

### 2. Create `.env` file

```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/auth-backend
ACCESS_SECRET=your_super_secret_access_key_here
REFRESH_SECRET=your_super_secret_refresh_key_here
NODE_ENV=development
```

> ⚠️ Use long, random strings for `ACCESS_SECRET` and `REFRESH_SECRET`. Never reuse them or commit them to Git.

### 3. Start the Server

```bash
npm start
```

Server starts at `http://localhost:8000`

---

## 🌍 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to run the server on. Defaults to `8000` |
| `MONGODB_URI` | **Yes** | Full MongoDB connection string |
| `ACCESS_SECRET` | **Yes** | Secret key to sign access tokens (JWT) |
| `REFRESH_SECRET` | No | Secret key to sign refresh tokens. Defaults to a hardcoded fallback |
| `NODE_ENV` | No | Set to `production` to enable secure cookies |

> `env.js` will **throw and crash the server** at startup if `MONGODB_URI` or `ACCESS_SECRET` is missing.

---

## 🏗️ Overall Architecture

### How a Request Travels Through the App

```
Client Request
     │
     ▼
server.js          — starts the process, connects DB, calls app.listen()
     │
     ▼
app.js             — registers global middleware (JSON parser, cookie parser, morgan)
     │
     ▼
user.route.js      — matches the URL and method to the right handler chain
     │
     ├── validate(schema)       (if route uses validation)
     ├── protect                (if route is protected)
     └── asyncWrapper(controller)
                   │
                   ▼
user.controller.js — reads from req, calls service, writes to res
                   │
                   ▼
user.service.js    — all business logic lives here (hashing, token creation, DB calls)
                   │
                   ▼
user.dao.js        — executes the actual Mongoose query against MongoDB
                   │
                   ▼
MongoDB            — stores/retrieves data
                   │
                   ▼
Response sent back to client
```

### How Errors Travel

```
Any error thrown (AppError or unexpected)
     │
     ▼
asyncWrapper catches it → calls next(error)
     │
     ▼
errorHandling.middleware.js (global error handler, last middleware in app.js)
     │
     ├── If AppError  →  res.status(err.statusCode).json({ status, message })
     └── If unknown   →  res.status(500).json({ status: 'error', message: 'Internal Server Error' })
```

### Layered Architecture (Separation of Concerns)

| Layer | Responsibility |
|---|---|
| **Route** | Declares the URL, method, and middleware chain |
| **Controller** | Reads `req`, calls one service, writes `res` |
| **Service** | Business logic — orchestrates DAOs, handles tokens, throws `AppError` |
| **DAO** | One function = one DB query, no business logic |
| **DTO** | Sanitises raw input before it enters services |
| **Validation** | Ensures the request shape is correct before controller runs |

---

## 🔑 Authentication & Authorization Architecture

### Token Strategy

| Token | Where stored | Expiry | Signed with |
|---|---|---|---|
| Access Token | JS memory (returned in JSON body) | 15 minutes | `ACCESS_SECRET` |
| Refresh Token | `httpOnly` cookie | 7 days | `REFRESH_SECRET` |

**Access token payload:** `{ id: userId, sessionId }`
**Refresh token payload:** `{ id: userId }`

### Why two tokens?

- **Access token** is short-lived (15 min). If stolen, damage is time-limited.
- **Refresh token** lives in an `httpOnly` cookie — JavaScript on the page **cannot read it**, which eliminates XSS-based token theft.
- When the access token expires, the client silently hits `POST /api/users/refresh` to get a new pair without making the user log in again.

### Session Model

Every login/register creates a **Session document** in MongoDB:

```
Session {
  userId       → which user this belongs to
  refreshToken → SHA-256 hash of the raw token (never store raw tokens)
  userAgent    → browser/client info
  ipAddress    → client IP
  isRevoked    → false by default, true after logout or token rotation
  expiresAt    → 7 days from creation (MongoDB TTL index auto-deletes this)
}
```

### Why store a session if we already have JWTs?

JWTs are stateless by default — once issued, you can't invalidate them before expiry. By linking every access token to a session document, logout becomes **instant**: set `isRevoked = true`, and the `protect` middleware rejects the token even if the JWT itself hasn't expired.

---

## 🛣️ API Routes — Detailed Flow

### Base URL: `/api/users`

---

### `POST /api/users/register`

**Middleware chain:** `validate(registerSchema)` → `asyncWrapper(registerUser)`

**Step-by-step flow:**

```
1. Request body: { name, email, password }

2. validate(registerSchema)  [validation.middleware.js]
   └── Zod checks: name not empty, valid email format, password ≥ 6 chars
   └── On failure → AppError(400) with field-level error message

3. registerUser controller  [user.controller.js]
   └── Reads userAgent + IP from request
   └── Calls registerUserService(req.body, reqMeta)

4. registerUserService  [user.service.js]
   └── toRegisterDTO(body)       → trims name, lowercases email
   └── findUserByEmailDAO(email) → checks if email already exists
       └── If exists → throw AppError('email already registered', 409)
   └── crypto.randomBytes(16)    → generates a random salt
   └── crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512') → hashes password
   └── createUserDAO({name, email, hashedPassword, salt}) → saves user to MongoDB
   └── createSessionAndTokens(userId, reqMeta):
       ├── refreshToken(userId) → signs JWT with REFRESH_SECRET (7d)
       ├── hashToken(rawRefreshToken) → SHA-256 hash
       ├── createSessionDAO({userId, hashedToken, userAgent, ip, expiresAt: +7d})
       └── accessToken(userId, session._id) → signs JWT with ACCESS_SECRET (15m)

5. registerUser controller (continued)
   └── Sets httpOnly cookie: refreshToken = raw JWT
   └── Returns 201 JSON:
       {
         status: 'success',
         message: 'user registered',
         data: {
           accessToken: '<jwt>',
           user: { id, name, email }
         }
       }
```

---

### `POST /api/users/login`

**Middleware chain:** `validate(loginSchema)` → `asyncWrapper(loginUser)`

**Step-by-step flow:**

```
1. Request body: { email, password }

2. validate(loginSchema)  [validation.middleware.js]
   └── Zod checks: valid email, password not empty

3. loginUser controller  [user.controller.js]
   └── Calls loginUserService(req.body, reqMeta)

4. loginUserService  [user.service.js]
   └── toLoginDTO(body)                           → trims & lowercases email
   └── findUserByEmailWithPasswordDAO(email)      → fetches user + password + salt
       └── If not found → throw AppError('invalid email or password', 401)
           (same message for both cases — prevents user enumeration)
   └── crypto.pbkdf2Sync(password, user.salt, ...) → re-hashes input
   └── Compares result to stored hash
       └── If mismatch → throw AppError('invalid email or password', 401)
   └── createSessionAndTokens(userId, reqMeta)    → same as register (see above)

5. loginUser controller (continued)
   └── Sets httpOnly refreshToken cookie
   └── Returns 200 JSON:
       {
         status: 'success',
         message: 'login successful',
         data: { accessToken, user: { id, name, email } }
       }
```

---

### `POST /api/users/refresh`

**Middleware chain:** `asyncWrapper(refreshAccessToken)` *(no auth, no validation)*

**Step-by-step flow:**

```
1. No request body needed.
   Refresh token is automatically read from the httpOnly cookie.

2. refreshAccessToken controller  [user.controller.js]
   └── Reads req.cookies.refreshToken
   └── Calls refreshTokenService(rawToken, reqMeta)

3. refreshTokenService  [user.service.js]
   └── If no token → throw AppError(401)
   └── verifyRefreshToken(rawToken) → verifies JWT signature + expiry with REFRESH_SECRET
       └── If invalid/expired → throw AppError('Invalid or expired refresh token', 401)
   └── hashToken(rawToken) → SHA-256 hash to look up in DB
   └── findSessionByHashDAO(userId, hashedToken) → finds session (any status)

   CASE 1 — session === null (token was never issued by us):
   └── throw AppError('refresh token is invalid', 401)

   CASE 2 — session.isRevoked === true (token reuse detected):
   └── revokeAllSessionsDAO(userId) → nukes ALL sessions for this user
   └── throw AppError('refresh token reuse detected — all sessions have been revoked', 401)
   [This forces re-login on every device if a stolen token is replayed]

   CASE 3 — session.isRevoked === false (legitimate use):
   └── revokeSessionDAO(session._id) → marks old session isRevoked: true
   └── createSessionAndTokens(userId, reqMeta) → creates brand new session + token pair

4. refreshAccessToken controller (continued)
   └── Sets new httpOnly refreshToken cookie (replaces old one)
   └── Returns 200 JSON:
       {
         status: 'success',
         data: { accessToken: '<new_jwt>' }
       }
```

---

### `POST /api/users/logout`

**Middleware chain:** `protect` → `asyncWrapper(logoutUser)`

**Step-by-step flow:**

```
1. Requires: Authorization: Bearer <accessToken> header

2. protect middleware  [auth.middleware.js]
   └── Extracts token from header
   └── verifyAccessToken(token) → decodes { id: userId, sessionId }
   └── findSessionByIdDAO(sessionId) → checks if session exists and is not revoked
       └── If missing or isRevoked → AppError(401)
   └── findUserByIdDAO(userId) → checks user still exists
       └── If not found → AppError(401)
   └── Attaches req.user and req.sessionId

3. logoutUser controller  [user.controller.js]
   └── Calls logoutUserService(req.sessionId)

4. logoutUserService  [user.service.js]
   └── revokeSessionDAO(sessionId) → sets isRevoked: true on THIS session only

5. logoutUser controller (continued)
   └── res.clearCookie('refreshToken') → removes cookie from browser
   └── Returns 200 JSON:
       {
         status: 'success',
         message: 'logged out successfully'
       }
```

> This logs out **only the current device**. Other devices/sessions remain active.

---

### `POST /api/users/logout-all`

**Middleware chain:** `protect` → `asyncWrapper(logoutAll)`

**Step-by-step flow:**

```
1. Requires: Authorization: Bearer <accessToken> header

2. protect middleware (same as above) → attaches req.user

3. logoutAll controller  [user.controller.js]
   └── Calls logoutAllService(req.user._id)

4. logoutAllService  [user.service.js]
   └── revokeAllSessionsDAO(userId) → sets isRevoked: true on ALL active sessions

5. logoutAll controller (continued)
   └── res.clearCookie('refreshToken')
   └── Returns 200 JSON:
       {
         status: 'success',
         message: 'logged out from all devices'
       }
```

---

### `GET /api/users/`

**Middleware chain:** `protect` → `asyncWrapper(getAllUsers)`

**Step-by-step flow:**

```
1. Requires: Authorization: Bearer <accessToken> header

2. protect middleware → authenticates request

3. getAllUsers controller  [user.controller.js]
   └── Calls getAllUsersService()

4. getAllUsersService  [user.service.js]
   └── getAllUsersDAO() → returns all users sorted by createdAt DESC
       (password and salt are excluded from the query projection)

5. Returns 200 JSON:
   {
     status: 'success',
     results: <count>,
     data: { users: [ ... ] }
   }
```

---

### `GET /api/users/profile`

**Middleware chain:** `protect` → `asyncWrapper(getUserProfile)`

**Step-by-step flow:**

```
1. Requires: Authorization: Bearer <accessToken> header

2. protect middleware → attaches req.user (the full user document, no password)

3. getUserProfile controller  [user.controller.js]
   └── Calls getUserProfileService(req.user._id)

4. getUserProfileService  [user.service.js]
   └── findUserByIdDAO(userId) → fetch user by ID (excludes password)
       └── If not found → throw AppError('user not found', 404)

5. Returns 200 JSON:
   {
     status: 'success',
     data: { user: { id, name, email } }
   }
```

---

## 🔄 Full Authentication Lifecycle

```
REGISTER / LOGIN
      │
      ▼
 AccessToken (15m)  ──────────────────────────────────────────► Use in Authorization header
 RefreshToken (7d)  ──► Stored in httpOnly cookie (browser handles this automatically)
 Session created in MongoDB

      │
      │  (15 min passes, access token expires)
      ▼
 POST /api/users/refresh  (browser sends cookie automatically)
      │
      ▼
 Old session revoked (isRevoked: true)
 New session created
 New AccessToken + new RefreshToken issued  ──────────────────► cycle continues

      │
      │ (user clicks "Logout")
      ▼
 POST /api/users/logout
      │
      ▼
 Session isRevoked: true
 Cookie cleared
 Any future request with the old accessToken → rejected by protect middleware
```

---

## 🛡️ Security Features

| Feature | Implementation |
|---|---|
| Password hashing | PBKDF2 + SHA-512 + random salt per user |
| Refresh token storage | Only SHA-256 hash stored in DB, raw token only in cookie |
| httpOnly cookies | Refresh token inaccessible to JavaScript (XSS-safe) |
| Refresh token rotation | Every `/refresh` call issues a brand new token pair |
| Token reuse detection | Replayed refresh tokens trigger full session revocation |
| Stateful logout | Sessions linked to access tokens via `sessionId` — logout is instant |
| Session TTL | MongoDB auto-deletes sessions after 7 days |
| User enumeration prevention | Login returns same error message for wrong email or wrong password |

---

## ⚠️ Issues & Suggestions

### 1. `bcryptjs` is installed but never used
**Issue:** `package.json` lists `bcryptjs` as a dependency, but passwords are hashed using the built-in `crypto` module (PBKDF2).
**Suggestion:** Either remove `bcryptjs` from `package.json` to avoid dead dependencies, or decide on one hashing strategy and stick to it. Both are fine — PBKDF2 is perfectly valid.

### 2. No `REFRESH_SECRET` validation at startup
**Issue:** `env.js` throws if `MONGODB_URI` or `ACCESS_SECRET` is missing, but `REFRESH_SECRET` silently falls back to a weak hardcoded string.
**Suggestion:** Add a check for `REFRESH_SECRET` the same way:
```js
if (!process.env.REFRESH_SECRET) throw new AppError('REFRESH_SECRET is not defined');
```

### 3. `process.exit(1)` is unreachable in `db.js`
**Issue:** In `connectDB`, the line `process.exit(1)` comes after `throw new Error(...)`. The throw will unwind the stack before `exit` is ever reached.
**Suggestion:** Replace the throw with `process.exit(1)` directly, or use the uncaught exception handler in `server.js`.

### 4. `GET /api/users/` returns ALL users — no pagination or role guard
**Issue:** Any authenticated user can fetch the full user list. In production this is a data leak.
**Suggestion:** Add a role field to the User model (e.g., `role: { type: String, enum: ['user', 'admin'] }`) and add an `authorize('admin')` middleware on that route.

### 5. No `dev` script in `package.json`
**Issue:** Only `npm start` exists. During development there is no auto-restart on file changes.
**Suggestion:** Add a dev script:
```json
"dev": "node --watch server.js"
```
Or install `nodemon` and use `"dev": "nodemon server.js"`.

### 6. Commented-out code in `validation.middleware.js`
**Issue:** The old version of the middleware (lines 40–62) is left as a comment block.
**Suggestion:** Delete it. Git history preserves it if you ever need to look back.

### 7. No rate limiting
**Issue:** `POST /login` and `POST /refresh` have no request rate limiting. An attacker can brute-force passwords or spam the refresh endpoint.
**Suggestion:** Add `express-rate-limit`:
```js
import rateLimit from 'express-rate-limit';
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
router.post('/login', loginLimiter, validate(loginSchema), asyncWrapper(loginUser));
```

### 8. No CORS configuration
**Issue:** `app.js` has no CORS middleware. If a frontend on a different origin calls this API, it will be blocked by the browser.
**Suggestion:** Add the `cors` package:
```js
import cors from 'cors';
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
```
`credentials: true` is required for cookies to work cross-origin.

---

## 🧰 Utility Reference

### `AppError` (src/utils/appError.js)
Custom error class extending `Error`. Sets `statusCode`, `status` (`'fail'` for 4xx, `'error'` for 5xx), and `isOperational: true` to distinguish known errors from unexpected crashes.

### `asyncWrapper` (src/utils/asyncWrapper.js)
Wraps an async controller function so that any rejected promise is automatically forwarded to `next()` (and thus to the global error handler). Removes the need for try/catch in every controller.

### `hashToken` (src/utils/auth.js)
One-way SHA-256 hash of a token string. Used to store a safe representation of the refresh token in MongoDB — if the DB is breached, attackers get hashes, not usable tokens.
