# RoboPulse Authentication Setup Guide

## Overview
RoboPulse uses JWT-based authentication with PostgreSQL backend. Username/password credentials are stored securely with bcrypt hashing.

## Default Credentials (Development)
- **Username**: `admin`
- **Password**: `admin`

⚠️ **IMPORTANT**: Change these credentials in production!

## Setup Steps

### 1. Start PostgreSQL and Redis (Docker)
```bash
docker-compose up -d
```

Verify containers are running:
```bash
docker ps | grep robopulse
```

### 2. Run Database Migrations
Migrations create the `users` table and seed initial data.

```bash
cd /path/to/RoboPulse
npm run db:migrate
```

Expected output:
```
[Applying] 001_initial_schema.sql...
[Success] Applied migration: 001_initial_schema.sql
[Applying] 002_users_technicians.sql...
[Success] Applied migration: 002_users_technicians.sql
[Applying] 003_alerts_and_auth_seed.sql...
[Success] Applied migration: 003_alerts_and_auth_seed.sql
```

**If migrations fail**: Verify PostgreSQL is running and credentials in `.env` match docker-compose.yml

### 3. Verify Database Setup
```bash
npm run db:verify
```

This should confirm tables exist and admin user is seeded.

### 4. Start Backend
```bash
cd backend
npm run dev
```

Expected output:
```
PostgreSQL connection established
Redis connection established
RoboPulse API running on http://localhost:5000
```

### 5. Start Frontend
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### 6. Login Test
1. Enter username: `admin`
2. Enter password: `admin`
3. Click "Sign in"
4. Should navigate to dashboard/overview page
5. Verify user session appears in sidebar

## Authentication Flow

### Frontend (`src/pages/LoginPage.tsx`)
1. User enters username and password
2. Form validates: both fields required, non-empty
3. Calls `loginUser(username, password)` API

### API Client (`src/api/auth.ts`)
1. POST request to `http://localhost:5000/api/auth/login`
2. Request body: `{ username, password }`
3. Response: `{ success: true, token: "JWT...", user: {...} }`

### Backend (`src/routes/auth.routes.ts` → `src/controllers/auth.controller.ts`)
1. Validates username/password not empty
2. Calls `loginUser()` service

### Auth Service (`src/services/auth.service.ts`)
1. Queries PostgreSQL: `SELECT * FROM users WHERE username = $1`
2. If user not found: throw 401
3. Compares password with bcrypt hash: `bcrypt.compare(password, password_hash)`
4. If no match: throw 401
5. If match: generates JWT token, returns `{ token, user }`

### Frontend Session (`src/App.tsx`)
1. Receives response from login API
2. Stores token in `localStorage` as `robopulse_token`
3. Stores user info in `localStorage` as `robopulse_user`
4. Sets `user` state → navigates to `/overview`
5. All subsequent API calls automatically attach `Authorization: Bearer {token}` header

## Troubleshooting

### "Unable to authenticate user" Error
**Cause**: Usually database migration hasn't run.

**Solution**:
```bash
npm run db:migrate
npm run db:verify
```

Then restart backend:
```bash
cd backend && npm run dev
```

### "Cannot find module './api/auth'" (Frontend Build Error)
**Cause**: Missing auth API file.

**Solution**: File should exist at `frontend/src/api/auth.ts`
```bash
npm run build  # Frontend build
```

### "PostgreSQL connection failed"
**Cause**: PostgreSQL container not running or credentials wrong.

**Solution**:
```bash
docker ps                    # Check if robopulse-postgres running
docker-compose logs postgres # View PostgreSQL logs
docker-compose down          # Stop containers
docker-compose up -d         # Restart containers
```

### "Invalid username or password"
**Cause**: Wrong credentials or user table corrupted.

**Solution**:
```bash
# Reset database completely
docker-compose down -v       # Remove all volumes
docker-compose up -d         # Recreate fresh containers
npm run db:migrate           # Re-apply migrations
npm run db:verify            # Verify setup
```

Then login with `admin` / `admin`.

## Security Notes

- Passwords are hashed with bcryptjs (10 rounds)
- JWT tokens expire after 8 hours
- Tokens are stored in `localStorage` (frontend should use `httpOnly` cookies in production)
- CORS is enabled to allow frontend on `http://localhost:5173`
- Backend API routes are not protected by default; only `/api/technicians` and `/api/alerts` require authentication

## Protected Routes

These endpoints require valid JWT token in `Authorization: Bearer {token}` header:
- `GET /api/technicians`
- `GET /api/technicians/:id`
- `POST /api/technicians`
- `PUT /api/technicians/:id`
- `DELETE /api/technicians/:id`
- `POST /api/technicians/:id/assignments/:robotId`
- `DELETE /api/technicians/:id/assignments/:robotId`
- `GET /api/alerts` (requires authentication)
- `PATCH /api/alerts/:id/acknowledge`
- `PATCH /api/alerts/:id/resolve`

## Session Lifecycle

1. **Login**: User submits credentials → receives JWT token
2. **Storage**: Token and user info stored in `localStorage`
3. **Auto-Auth**: Frontend checks `localStorage` on page reload → restores session
4. **Request Headers**: All API calls include `Authorization: Bearer {token}`
5. **Token Expiry**: After 8 hours, token becomes invalid → user must re-login
6. **Logout**: `localStorage` cleared → navigates to login page

## Environment Variables

**Backend** (`backend/.env`):
```
PORT=5000
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=robopulse
DATABASE_USER=robopulse_user
DATABASE_PASSWORD=robopulse_password
JWT_SECRET=robopulse-dev-secret  # Change in production!
REDIS_HOST=localhost
REDIS_PORT=6380
```

**Frontend** (`frontend/.env` or via Vite):
```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Next Steps

1. ✅ Verify login works with `admin` / `admin`
2. Explore dashboard and verify data loads
3. Test technician management endpoints
4. Test alert acknowledge/resolve workflow
5. Generate new admin user and disable default `admin` user
6. Deploy to production with secure environment variables
