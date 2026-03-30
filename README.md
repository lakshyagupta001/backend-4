# Project Auth Learning Journal

## Overview
This project is a Node.js + Express backend focused on authentication and clean architecture.

It demonstrates:
- Layered backend design
- Async error handling with centralized middleware
- Input validation, DTO mapping, and DAO abstraction
- JWT-based login flow
- MongoDB integration with Mongoose

## Tech Stack
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT
- bcryptjs
- dotenv
- morgan

## What I Built
- User registration API
- User login API
- Get all users API
- Structured error handling using `AppError`, `asyncWrapper`, and global error middleware
- Clear separation of responsibilities across routes, controllers, services, DAOs, DTOs, and validations

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

## Architecture
### Request Lifecycle
1. Client sends a request to an API endpoint.
2. The request hits a route in `src/routes/user.route.js`.
3. The route forwards the request to a controller in `src/controllers/user.controller.js`.
4. The controller calls a service in `src/services/user.service.js`.
5. The service handles validation, DTO transformation, business logic, and security logic.
6. The service calls the DAO layer in `src/daos/user.dao.js`.
7. The DAO interacts with the Mongoose model in `src/models/user.models.js`.
8. The controller sends the final response back to the client.

### Error Handling Flow
1. Route handlers are wrapped with `asyncWrapper`.
2. Errors thrown in async code are forwarded with `next(error)`.
3. Express skips normal middleware and enters the global error middleware in `src/middleware/errorHandling.js`.
4. If the error is an `AppError`, a structured status and message are returned.
5. Unknown errors return a `500 Internal Server Error` response.

### Authentication Flow
#### Register
1. Validate input.
2. Normalize request data using DTO mapping.
3. Check whether the email already exists.
4. Hash the password using `bcryptjs`.
5. Save the user to MongoDB.
6. Return a JWT token and a safe user object.

#### Login
1. Validate input.
2. Find the user and include the password field.
3. Compare the submitted password with the stored hash.
4. Return a JWT token and a safe user object.

#### Token Generation
- JWT tokens are created in `src/utils/auth.js`.

## JWT Token Flow Step by Step
### 1. User registers or logs in
- The client sends a request to `POST /api/users/register` or `POST /api/users/login`.
- The request goes through route -> controller -> service.

### 2. Backend creates the token
- After successful registration or login, the service calls `signToken(user._id)`.
- In `src/utils/auth.js`, `jwt.sign()` creates a token using:
  - payload: `{ id: userId }`
  - secret: `JWT_SECRET`
  - expiry: `7d`

Example:
```js
jwt.sign({ id: userId }, config.JWT_SECRET, { expiresIn: '7d' });
```

### 3. Token is sent to the client
- The backend returns the token in the JSON response.

Example response:
```json
{
  "status": "success",
  "data": {
    "token": "your_jwt_token",
    "user": {
      "id": "user_id",
      "name": "Lakshya",
      "email": "lakshya@example.com"
    }
  }
}
```

### 4. Client stores the token
- The backend does not store the token in MongoDB.
- The client usually stores it in:
  - `localStorage`
  - `sessionStorage`
  - cookies

### 5. Client sends token in future requests
- When accessing a protected route, the client sends the token in the `Authorization` header.

Example client-side request:
```js
fetch('/api/users', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

### 6. Backend reads the token
- The auth middleware checks `req.headers.authorization`.
- It confirms the header exists and starts with `Bearer `.
- Then it extracts the token part.

### 7. Backend verifies the token
- In `src/middleware/authMiddleware.js`, the middleware runs `jwt.verify(token, config.JWT_SECRET)`.
- This checks:
  - the token was signed by this backend
  - the token was not changed
  - the token is not expired

If verification fails, the request is rejected with `401`.

### 8. Backend checks whether the user still exists
- After decoding the token, the middleware reads the user id from the payload.
- It looks up that user in MongoDB.
- If the user no longer exists, the request is rejected.

### 9. Backend attaches the user to the request
- If everything is valid, the middleware stores the user in `req.user`.
- Then `next()` passes control to the route controller.

### 10. Protected route runs
- The controller now handles the request normally.
- Because the token is valid, the user is considered authenticated.

### 11. Token expiry
- The token expires because it was created with `expiresIn: '7d'`.
- After 7 days, protected routes stop accepting that token.
- The user can still log in again with email and password to receive a new token.

## Environment and Startup Flow
1. `src/configs/env.js` loads `dotenv` and validates required environment variables.
2. `src/configs/db.js` connects to MongoDB using Mongoose.
3. `server.js` starts the Express app only after a successful database connection.
4. `src/app.js` registers JSON parsing, request logging, routes, and error middleware.

## Setup and Run
### 1. Install dependencies
```bash
npm install
```

### 2. Create a `.env` file
```env
PORT=8000
MONGODB_URI=mongodb://localhost:27017/myapp
JWT_SECRET=your_jwt_secret
```

### 3. Start the server
```bash
npm start
```

## APIs Implemented
Base route: `/api/users`

- `POST /api/users/register`
- `POST /api/users/login`
- `GET /api/users/`

## What I Learned
- How to structure backend code in layers instead of putting all logic in routes.
- Why services are the right place for business logic and controllers should stay thin.
- How the DAO layer makes database operations reusable and easier to reason about.
- How DTOs help normalize request data and reduce repeated parsing logic.
- How to design centralized error handling instead of scattered `try/catch` blocks.
- Why `throw new AppError(...)` is necessary to trigger Express error flow cleanly.
- How `asyncWrapper` reduces repetitive async error handling.
- Practical use of `bcryptjs` for password hashing and JWT for authentication.
- The importance of exact import paths and `.js` extensions in ESM projects.

## Debugging Approach I Followed
1. Start with startup errors first, especially imports and environment issues.
2. Verify boot order: `env -> db -> app listen`.
3. Trace each endpoint layer-by-layer: `route -> controller -> service -> dao -> model`.
4. Test both success and failure cases.
5. Confirm status codes and error response shapes from the global middleware.
6. Fix one issue at a time and rerun.

## Future Improvements
- Add auth middleware to protect private routes.
- Add refresh token flow and logout strategy.
- Add pagination for user listing.
- Add centralized structured logging.
- Add unit and integration tests.
- Add production-ready handling for Mongoose and JWT-specific errors.
- Add API documentation.

## Author
Lakshya Gupta
