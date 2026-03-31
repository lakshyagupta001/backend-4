# Project Auth Learning Journal

## Overview
This project is a Node.js + Express backend focused on authentication and clean architecture.

It demonstrates:
- Layered backend design
- Async error handling with centralized middleware
- Input validation, DTO mapping, and DAO abstraction
- **Advanced Dual-Token (Access + Refresh) flow**
- Secure `httpOnly` cookie implementation
- MongoDB integration with Mongoose

## Tech Stack
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT (JSON Web Tokens)
- `crypto` (Node.js built-in for PBKDF2 hashing)
- cookie-parser
- dotenv
- morgan

## How This Project Differs from the Previous One
Your previous project used a single JWT with 7-day expiry sent in JSON and stored by the client. This project implements the industry-standard dual-token system:

| Feature | Previous project | This project |
|---|---|---|
| Token type | Single JWT (`token`) | Access token + Refresh token |
| Token expiry | 7 days | 15 min (access) / 7 days (refresh) |
| Token storage | Client stores in localStorage / cookie | Access token in memory, RT in `httpOnly` cookie |
| Token stored in DB? | No | Yes — RT is saved in MongoDB |
| Logout | Client just deletes the token | Server deletes RT from DB + clears cookie |
| Password hashing | `bcryptjs` | `crypto` (Node built-in, PBKDF2 + salt) |
| Refresh route | None | `POST /api/users/refresh` |
| Logout route | None | `POST /api/users/logout` |

## Project Structure
```text
project-auth/
├── server.js
├── package.json
├── package-lock.json
├── README.md
└── src/
    ├── app.js
    ├── configs/
    │   ├── db.js
    │   └── env.js
    ├── controllers/
    │   └── user.controller.js
    ├── daos/
    │   └── user.dao.js
    ├── dtos/
    │   └── user.dto.js
    ├── middleware/
    │   ├── authMiddleware.js
    │   └── errorHandling.js
    ├── models/
    │   └── user.models.js
    ├── routes/
    │   └── user.route.js
    ├── services/
    │   └── user.service.js
    ├── utils/
    │   ├── appError.js
    │   ├── asyncWrapper.js
    │   └── auth.js
    └── validations/
        └── user.validation.js
```

## Architecture — Layer by Layer
```text
Request
  │
  ▼
Route (user.route.js)         — decides which controller handles the request
  │
  ▼
Middleware (authMiddleware.js) — verifies access token on protected routes
  │
  ▼
Controller (user.controller.js) — handles HTTP (reads req, writes res, sets cookies)
  │
  ▼
Service (user.service.js)     — all business logic lives here
  │
  ▼
DAO (user.dao.js)             — all MongoDB queries live here (nothing else)
  │
  ▼
Model (user.models.js)        — Mongoose schema definition
```
Each layer only talks to the layer directly below it. Controllers never touch MongoDB. Services never touch `req` or `res`.

### Error Handling Flow
1. Route handlers are wrapped with `asyncWrapper`.
2. Errors thrown in async code are forwarded with `next(error)`.
3. Express skips normal middleware and enters the global error middleware in `src/middleware/errorHandling.js`.
4. If the error is an `AppError`, a structured status and message are returned.
5. Unknown errors return a `500 Internal Server Error` response.

## The Dual-Token System — What it is and Why

### Why two tokens?
- A **long-lived token** (7 days) is a security risk — if it gets stolen, the attacker has access for 7 days and you can't stop them.
- A **short-lived access token** (15 min) limits that window to 15 minutes.
- The **refresh token** (7 days, stored in DB) lets the client silently get a new access token without asking the user to log in again.
- Because the refresh token is stored in DB, you can **revoke it instantly** on logout.

### Why httpOnly cookie for the refresh token?
- The refresh token is set as an `httpOnly` cookie by the server.
- `httpOnly` means **JavaScript cannot read it** — so even if your frontend has an XSS vulnerability, the attacker's JS cannot steal the refresh token.
- The access token is short-lived (15 min) and kept only in JS memory (not localStorage), so it is also never exposed long-term.

## Full Request Flow Step by Step

### Register — `POST /api/users/register`
1. Route receives `POST /api/users/register` → calls `registerUser` controller
2. Controller calls `registerUserService(req.body)`
3. Service:
   a. `validateRegisterInput()`  — throws AppError if name/email/password missing or invalid
   b. `toRegisterDTO()`          — normalizes and trims the incoming data
   c. `findUserByEmailDAO()`     — checks if email already exists → 409 if it does
   d. `crypto.randomBytes()`     — generates a random 16-byte salt
   e. `crypto.pbkdf2Sync()`      — hashes password with that salt (1000 iterations, SHA-512)
   f. `createUserDAO()`          — saves user to MongoDB
   g. `refreshToken(user._id)`   — creates a 7-day JWT signed with REFRESH_SECRET
   h. `saveRefreshTokenDAO()`    — saves the refresh token to the user document in MongoDB
   i. `accessToken(user._id)`    — creates a 15-min JWT signed with ACCESS_SECRET
   j. returns `{ accessToken, refreshToken, user }`
4. Controller:
   a. `res.cookie('refreshToken', ...)`  — sets the RT as an httpOnly, secure, sameSite=strict cookie
   b. `res.json({ accessToken, user })`  — returns access token + safe user object in JSON (refresh token is NOT in the JSON body — only in the cookie)

### Login — `POST /api/users/login`
1. Route receives `POST /api/users/login` → calls `loginUser` controller
2. Controller calls `loginUserService(req.body)`
3. Service:
   a. `validateLoginInput()`              — validates email and password present
   b. `toLoginDTO()`                      — normalizes the input
   c. `findUserByEmailWithPasswordDAO()`  — fetches user including password and salt fields (they are select:false by default, must opt in)
   d. `crypto.pbkdf2Sync()`               — hashes submitted password with stored salt
   e. compares result to stored hash      — throws 401 if mismatch
   f. `refreshToken(user._id)`            — creates a new 7-day refresh token
   g. `saveRefreshTokenDAO()`             — overwrites the old RT in MongoDB with the new one
   h. `accessToken(user._id)`             — creates a new 15-min access token
   i. returns `{ accessToken, refreshToken, user }`
4. Controller:
   a. sets `refreshToken` httpOnly cookie
   b. returns `accessToken` + `user` in JSON

### Accessing a Protected Route (e.g. `GET /api/users/profile`)
1. Client sends request with:
   `Authorization: Bearer <accessToken>`
   *(Cookie: refreshToken=... is sent automatically by the browser)*
2. `protect` middleware runs:
   a. reads Authorization header
   b. checks it starts with 'Bearer '
   c. extracts the token
   d. `verifyAccessToken(token)` — `jwt.verify()` with ACCESS_SECRET → throws 401 if token is invalid or expired
   e. `findUserByIdDAO(decoded.id)` — checks user still exists in MongoDB → throws 401 if user was deleted
   f. `req.user = currentUser` — attaches user to request
   g. `next()` — passes to controller
3. Controller runs `getUserProfileService(req.user._id)`
4. Service fetches and returns safe user object
5. Controller sends 200 response

### Refreshing the Access Token — `POST /api/users/refresh`
*This route has NO protect middleware — it is public.*
The client calls this when:
- The access token has expired (they get a 401 from a protected route)
- They do not have an access token yet (e.g. on page refresh)

1. Route receives `POST /api/users/refresh`
2. Controller reads `req.cookies.refreshToken` (the httpOnly cookie)
3. Controller calls `refreshTokenService(token)`
4. Service:
   a. throws 401 if token is missing
   b. `verifyRefreshToken(token)` — `jwt.verify()` with REFRESH_SECRET → throws 401 if expired or tampered
   c. `findUserByRefreshTokenDAO(token)` — looks up user by the exact token string in MongoDB → throws 401 if not found (means the token was revoked by logout)
   d. `accessToken(decoded.id)` — creates a new 15-min access token
   e. returns `{ accessToken }`
5. Controller sends 200 with the new access token

### Logout — `POST /api/users/logout`
*This route IS protected — the client must send a valid access token.* Why? To confirm it is the actual user logging out, not a random request.

1. `protect` middleware validates the access token (same as above)
2. Controller calls `logoutUserService(req.user._id)`
3. Service calls `clearRefreshTokenDAO(userId)` → sets `refreshToken = null` in MongoDB
4. Controller calls `res.clearCookie('refreshToken')` — removes the cookie from the client
5. Returns 200 with "logged out successfully"

Now:
- The refresh token in MongoDB is null → `/refresh` will return 401
- The cookie is cleared from the browser → no more automatic cookie sending
- The old access token still technically works for up to 15 more minutes (this is an accepted trade-off of stateless access tokens)

## Password Hashing — `crypto` vs `bcryptjs`
Your previous project used `bcryptjs`. This project uses Node's built-in `crypto` module.

```js
// Generate a unique random salt per user
const salt = crypto.randomBytes(16).toString('hex');
// Hash password: 1000 rounds, 64-byte output, SHA-512
const hashedPassword = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');
```

Both approaches are secure. The key idea:
- The **salt** makes sure two users with the same password get different hashes.
- The **iterations (1000)** make brute-force attacks slower.
- Salt and password are stored separately, both with `select: false` (never returned in queries by default).

## Token Generation — `src/utils/auth.js`
```js
// Creates a 15-minute access token
export const accessToken = (userId) =>
    jwt.sign({ id: userId }, config.ACCESS_SECRET, { expiresIn: '15m' });

// Creates a 7-day refresh token
export const refreshToken = (userId) =>
    jwt.sign({ id: userId }, config.REFRESH_SECRET, { expiresIn: '7d' });

// Verifies access token — throws AppError on failure
export const verifyAccessToken = (token) => { ... }

// Verifies refresh token — throws AppError on failure
export const verifyRefreshToken = (token) => { ... }
```

Two separate secrets means:
- An access token cannot be used as a refresh token and vice versa.
- Rotating one secret doesn't invalidate the other.

## Stateful vs Stateless Authentication

### What do "stateful" and "stateless" mean?

The key question is: **where does the server remember who you are?**

| | Stateful | Stateless |
|---|---|---|
| **Server stores session?** | Yes — in memory, DB, or Redis | No — the token itself carries all info |
| **How server identifies you** | Looks up your session ID in its store | Decodes and verifies the token's signature |
| **DB hit on every request?** | Yes — to look up session data | No — JWT is self-contained |
| **Revocation** | Easy — delete the session from the store | Hard — token is valid until it expires |
| **Scalability** | Harder — all servers need access to the session store | Easier — any server with the secret can verify |
| **Example** | Express sessions, PHP sessions | JWT access tokens |

### Stateful (Session-Based) — How it works
```text
Client                          Server                         Store (DB/Redis)
  │  POST /login {email, pass}    │                               │
  ├─────────────────────────────►│                               │
  │                              │  validate credentials         │
  │                              │  create session object         │
  │                              │──save session────────────────►│
  │                              │  (sessionId → {userId, ...})   │
  │◄─────────────────────────────│                               │
  │  Set-Cookie: sessionId=abc   │                               │
  │                              │                               │
  │  GET /profile                │                               │
  │  Cookie: sessionId=abc       │                               │
  ├─────────────────────────────►│                               │
  │                              │──lookup "abc"────────────────►│
  │                              │◄──{userId: 123}───────────────│
  │                              │  fetch user from DB            │
  │◄─────────────────────────────│                               │
  │  { name: "Lakshya", ... }    │                               │
```
- The **session ID** is meaningless on its own — it's just a random string.
- The server **must** look it up in a store to know who you are.
- To log out: delete the session from the store. Immediately effective.

### Stateless (Token-Based) — How it works
```text
Client                          Server
  │  POST /login {email, pass}    │
  ├─────────────────────────────►│
  │                              │  validate credentials
  │                              │  jwt.sign({ id: userId }, SECRET, { expiresIn: '15m' })
  │◄─────────────────────────────│
  │  { accessToken: "eyJhb..." } │
  │                              │
  │  GET /profile                │
  │  Authorization: Bearer eyJ.. │
  ├─────────────────────────────►│
  │                              │  jwt.verify(token, SECRET)
  │                              │  → { id: userId }  (decoded from token itself)
  │                              │  fetch user from DB
  │◄─────────────────────────────│
  │  { name: "Lakshya", ... }    │
```
- The **JWT itself contains the user's identity** (the `id` field in the payload).
- The server doesn't store or look up the token — it just **verifies the signature**.
- If the signature is valid and not expired → the server trusts the payload.
- To "log out": you can't invalidate the token — you have to wait for it to expire.

### Why stateless tokens can be "swapped" between devices

This is the scenario you tested:
```text
Device A: logs in as User 1 → gets accessToken containing { id: "user1_id" }
Device B: logs in as User 2 → gets accessToken containing { id: "user2_id" }

You copied User 1's accessToken and used it on Device B.
Server receives the token → jwt.verify() → decoded.id = "user1_id"
Server fetches User 1 from DB → returns User 1's profile.
```

**This is not a bug — this is how stateless tokens work by design.** The server doesn't know (or care) *which device* sent the token. It only checks:
1. Is the signature valid? (was it signed with my secret?)
2. Is it expired?
3. Does the user still exist?

If all three pass, the request is authorized. **The token IS the identity.**

With a **stateful session**, this swap would fail because:
- Device A's session ID maps to User 1 in the server's store
- Device B's session ID maps to User 2 in the server's store
- If you send Device A's session ID from Device B, the server looks it up and finds User 1 — same result actually! Session IDs can be stolen too.

**The real protection** in both approaches is **preventing the token/session from being stolen in the first place** (HTTPS, httpOnly cookies, secure storage).

---

## Tokens vs Sessions — Detailed Comparison

| Aspect | Sessions (Stateful) | Tokens / JWT (Stateless) |
|---|---|---|
| **Where identity is stored** | Server-side (DB, Redis, memory) | Inside the token itself (client-side) |
| **What the client holds** | A random session ID (meaningless string) | A self-contained JWT with encoded payload |
| **Server verification** | Look up session ID in store → get user data | Verify JWT signature → decode payload |
| **DB hit per request** | Yes (session lookup) | No (unless you choose to check DB) |
| **Size** | Cookie: ~32 bytes (just the ID) | Cookie/Header: ~300-800 bytes (full JWT) |
| **Revocation** | Instant — delete from store | Can't revoke until expiry (unless you add a blacklist, which makes it stateful again) |
| **Scaling** | All servers need access to the same session store | Any server with the secret can verify — no shared store needed |
| **CSRF vulnerability** | Yes — cookies are sent automatically | No (if token is in Authorization header, not cookie) |
| **XSS vulnerability** | If session cookie is not httpOnly | If token is stored in localStorage (JS can read it) |
| **Best for** | Server-rendered apps, apps where instant revocation is critical | APIs, SPAs, microservices, mobile apps |
| **Logout** | Delete session → immediately locked out | Token still valid until expiry → need short TTL |

### When to use what?

**Use sessions when:**
- You need instant logout / instant permission changes
- You're building a server-rendered app (like EJS, Handlebars)
- You don't need to scale across many servers
- You want the server to have full control over who's logged in

**Use tokens (JWT) when:**
- You're building an API consumed by SPAs or mobile apps
- You need to scale horizontally (multiple servers, no shared state)
- You want the client to hold its own proof of identity
- You're building microservices where different services need to verify identity

**Use both (hybrid — like this project):**
- Access token (stateless) for fast, scalable request authentication
- Refresh token (stateful) for revocation control and security

---

## How This Project Implements Both — The Hybrid Approach

This project uses a **hybrid stateless + stateful** design. Here's exactly what's stateless and what's stateful:

### The Access Token — STATELESS
```js
// src/utils/auth.js
export const accessToken = (userId) =>
    jwt.sign({ id: userId }, config.ACCESS_SECRET, { expiresIn: '15m' });
```
```js
// src/middleware/authMiddleware.js — the protect middleware
decoded = verifyAccessToken(token);                    // just verifies signature, NO DB lookup for the token
const currentUser = await findUserByIdDAO(decoded.id); // looks up the USER (not the token) to confirm they still exist
req.user = currentUser;
```

**Why it's stateless:**
- The access token is **never stored in the DB**.
- The server verifies it using only the `ACCESS_SECRET` — no session store, no token lookup.
- The DB query is just to check the user still exists (a safety check, not a session lookup).
- **Trade-off:** You cannot revoke an access token. If it's stolen, it works for up to 15 minutes. This is why the expiry is short.

### The Refresh Token — STATEFUL
```js
// src/services/user.service.js — on login
const newRefreshToken = refreshToken(user._id);
await saveRefreshTokenDAO(user._id, newRefreshToken);  // ← STORED IN DB — this makes it stateful
```
```js
// src/services/user.service.js — on refresh
const decoded = verifyRefreshToken(token);             // verify signature first
const user = await findUserByRefreshTokenDAO(token);   // ← MUST EXIST IN DB — this is the stateful check
if (!user) throw new AppError('refresh token is invalid or has been revoked', 401);
```
```js
// src/services/user.service.js — on logout
await clearRefreshTokenDAO(userId);  // ← set to null in DB — instant revocation
```

**Why it's stateful:**
- The refresh token **is stored in MongoDB** on the user document.
- On `/refresh`, the server doesn't just verify the JWT — it **also checks that the exact token string exists in the DB**.
- On `/logout`, the server **deletes the token from DB**. Now even if someone has the JWT, `findUserByRefreshTokenDAO()` returns null → 401 rejected.
- **This gives you instant revocation** — the stateful part provides the control that stateless tokens can't.

### Mental Model — The Hybrid
```text
┌─────────────────────────────────────────────────────┐
│                  YOUR AUTH SYSTEM                    │
│                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │    ACCESS TOKEN       │  │   REFRESH TOKEN       │ │
│  │    (Stateless)        │  │   (Stateful)          │ │
│  │                      │  │                       │ │
│  │  • 15 min expiry     │  │  • 7 day expiry       │ │
│  │  • Sent in header    │  │  • Sent as httpOnly    │ │
│  │  • NOT in DB         │  │    cookie              │ │
│  │  • Cannot revoke     │  │  • STORED in MongoDB   │ │
│  │  • Fast (no DB hit   │  │  • CAN revoke (delete  │ │
│  │    for token check)  │  │    from DB on logout)  │ │
│  │  • Used on EVERY     │  │  • Used only when      │ │
│  │    protected request │  │    access token expires │ │
│  └──────────────────────┘  └──────────────────────┘ │
│                                                     │
│  Together: fast + secure + revocable                │
└─────────────────────────────────────────────────────┘
```

### Why not make access tokens stateful too?

You *could* store every access token in the DB and check it on every request. But then:
- Every single API request would need a DB query just to verify the token
- You lose the main advantage of JWTs (stateless, scalable verification)
- At that point, you might as well use sessions

The 15-minute expiry on the access token is the compromise: even if one is stolen, the damage window is short, and the refresh token (which grants new access tokens) is protected by both the DB check and the httpOnly cookie.

---

## Data Flow Diagrams

### Login flow
```text
Client
  │  POST /login  { email, password }
  ▼
Controller
  │  calls loginUserService()
  ▼
Service
  │  hashes password, checks DB, generates tokens, saves RT to DB
  ▼
Controller
  │  Set-Cookie: refreshToken=<RT>; HttpOnly
  │  JSON: { accessToken, user }
  ▼
Client stores accessToken in memory only
```

### Refresh flow (when access token expires)
```text
Client (access token expired)
  │  POST /refresh
  │  Cookie: refreshToken=<RT>  ← sent automatically
  ▼
Controller reads req.cookies.refreshToken
  │  calls refreshTokenService(token)
  ▼
Service
  │  verifies JWT signature → checks RT exists in MongoDB
  │  generates new accessToken
  ▼
Controller
  │  JSON: { accessToken }
  ▼
Client updates its in-memory access token, retries original request
```

## Environment and Startup Flow
1. `src/configs/env.js` loads `dotenv` and validates required environment variables.
2. `src/configs/db.js` connects to MongoDB using Mongoose.
3. `server.js` starts the Express app only after a successful database connection.
4. `src/app.js` registers JSON parsing, request logging, route mounting, cookie-parser, and error middleware.

## Setup and Run
### 1. Install dependencies
```bash
npm install
```

### 2. Create a `.env` file
```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/myapp
ACCESS_SECRET=your_jwt_access_secret
REFRESH_SECRET=your_jwt_refresh_secret
NODE_ENV=development
```

### 3. Start the server
```bash
npm start
```

## APIs Implemented
Base route: `/api/users`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/register` | Public | Register new user |
| POST | `/login` | Public | Login, receive tokens |
| POST | `/refresh` | Public | Get new access token via RT cookie |
| POST | `/logout` | Protected | Revoke RT + clear cookie |
| GET | `/profile` | Protected | Get logged-in user's profile |
| GET | `/` | Protected | Get all users |

## What I Learned (Building on Previous Project)
- Why a single long-lived JWT is a security risk and how dual tokens solve it.
- How `httpOnly` cookies protect the refresh token from XSS attacks.
- The difference between **stateless** (access token — verified with secret, no DB hit) and **stateful** (refresh token — must exist in DB to be valid).
- How to use Node's built-in `crypto` module for PBKDF2 hashing with a salt.
- Why the refresh token must be stored in MongoDB — without it, you can't revoke on logout.
- Why `select: false` on the `refreshToken` and `password` fields prevents them from ever accidentally leaking in API responses.
- How `findUserByRefreshTokenDAO` acts as the gate for the refresh endpoint — even a valid JWT is rejected if it's not in the DB.
- Why services are the right place for business logic and controllers should stay thin.
- How the DAO layer makes database operations reusable and easier to reason about.
- How to design centralized error handling instead of scattered `try/catch` blocks.
- How `asyncWrapper` reduces repetitive async error handling.

## Debugging Approach I Followed
1. Start with startup errors first, especially imports and environment issues.
2. Verify boot order: `env -> db -> app listen`.
3. Trace each endpoint layer-by-layer: `route -> controller -> service -> dao -> model`.
4. Test both success and failure cases.
5. Confirm status codes and error response shapes from the global middleware.
6. Fix one issue at a time and rerun.

## Future Improvements
- Add pagination for user listing.
- Add centralized structured logging.
- Add unit and integration tests.
- Add production-ready handling for Mongoose and JWT-specific errors.
- Add API documentation (e.g., Swagger).

## Author
Lakshya Gupta
