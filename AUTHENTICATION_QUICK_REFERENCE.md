# RoboPulse Authentication - Quick Reference

## 📌 Login Endpoint

```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

Request Body:
{
  "username": "admin",
  "password": "admin"
}

Response (Success 200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "40000000-0000-0000-0000-000000000001",
    "username": "admin",
    "role": "admin"
  }
}

Response (Failure 401):
{
  "success": false,
  "message": "Invalid username or password"
}
```

---

## 🔑 Development Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |
| Role | `admin` |
| Expires | 8 hours after login |

⚠️ **DO NOT USE IN PRODUCTION**

---

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   Frontend      │
│  (React/Vite)   │
└────────┬────────┘
         │
    POST /auth/login
         │
         ▼
┌─────────────────────────────┐
│   Backend API               │
│   (Express + TypeScript)    │
│                             │
│  /api/auth/login ────────┐  │
│  /api/robots             │  │
│  /api/sensors      ──────┼──┼──► PostgreSQL
│  /api/alerts             │  │    (Database)
│  /api/maintenance ───────┘  │
│                             │
└─────────────────────────────┘
         │
         ▼
    Redis Cache
    (Session & Data)
```

---

## 🚀 Quick Commands

### Setup Database
```bash
# Start containers
docker-compose up -d

# Apply migrations
npm run db:migrate

# Verify schema
npm run db:verify
```

### Run Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Monitor (optional)
npm run test:auth
```

### Test Login
```bash
# Direct API test
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Browser test
# Open: http://localhost:5173
# Enter: admin / admin
# Click: Login
```

---

## 📊 Request Flow

```
1. User submits login form (admin/admin)
   └─> Frontend LoginPage.tsx validates inputs
       └─> Calls api/auth.ts loginUser()
           └─> POST to http://localhost:5000/api/auth/login

2. Backend receives request
   └─> auth.routes.ts mounts request to auth.controller.ts
       └─> Extracts username and password
           └─> Calls auth.service.ts loginUser()

3. Service verifies credentials
   └─> Queries PostgreSQL: SELECT * FROM users WHERE username = ?
       └─> Compares bcrypt hash: bcrypt.compare(password, hash)
           └─> If match: Generates JWT token
               If no match: Returns 401 error

4. Response sent to frontend
   └─> Success: Token stored in localStorage
       └─> Axios interceptor adds Authorization header
           └─> Redirect to dashboard
   
   └─> Failure: Error message displayed to user
       └─> Retry login form
```

---

## 🔗 API Interceptor

Frontend automatically adds authentication to requests:

```javascript
// Every request includes:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Example:
GET http://localhost:5000/api/robots
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🛡️ Protected Routes (Require JWT)

These routes require valid token in Authorization header:

```
GET    /api/robots
POST   /api/robots
GET    /api/robots/:id
PUT    /api/robots/:id
DELETE /api/robots/:id

GET    /api/sensors
POST   /api/sensors

GET    /api/production-lines
POST   /api/production-lines

GET    /api/alerts
POST   /api/alerts

GET    /api/maintenance
POST   /api/maintenance

GET    /api/predictions
POST   /api/predictions

GET    /api/technicians
POST   /api/technicians
```

Public routes (no token required):
```
POST   /api/auth/login
GET    /api/health
```

---

## 🧪 Common Test Scenarios

### Test 1: Valid Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Expected: 200 with token
```

### Test 2: Invalid Password
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'

# Expected: 401 with "Invalid username or password"
```

### Test 3: Invalid Username
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nouser","password":"admin"}'

# Expected: 401 with "Invalid username or password"
```

### Test 4: Protected Route with Token
```bash
# First get token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.token')

# Then use it
curl http://localhost:5000/api/robots \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 with robots data
```

### Test 5: Protected Route without Token
```bash
curl http://localhost:5000/api/robots

# Expected: 401 with "No authorization token provided"
```

---

## 📊 Environment Variables

### Root `.env`
```
DB_HOST=localhost
DB_PORT=5433
DB_NAME=robopulse
DB_USER=robopulse_user
DB_PASSWORD=robopulse_password
```

### `backend/.env`
```
PORT=5000
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_NAME=robopulse
DATABASE_USER=robopulse_user
DATABASE_PASSWORD=robopulse_password
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_SECRET=robopulse-dev-secret
```

### Docker Compose Ports
```
PostgreSQL: 5433 (internal: 5432)
Redis:      6380 (internal: 6379)
Backend API: 5000
Frontend:   5173
```

---

## ⚙️ Configuration Files

### Authentication Service
📄 [backend/src/services/auth.service.ts](backend/src/services/auth.service.ts)
- JWT expiration: 8 hours
- Bcrypt rounds: 10
- Hash algorithm: bcryptjs

### Database Schema
📄 [database/migrations/002_users_technicians.sql](database/migrations/002_users_technicians.sql)
- `users` table with username, password_hash, role
- Index on username for fast lookups
- Timestamps for created_at

### CORS Configuration
📄 [backend/src/server.ts](backend/src/server.ts)
- Enabled for all origins in development
- Use environment variable to restrict in production

---

## 🐛 Troubleshooting Quick Links

| Issue | Command | Guide |
|-------|---------|-------|
| Backend not responding | `curl http://localhost:5000/api/health` | See AUTHENTICATION_DEBUGGING.md |
| Login fails "Unable to authenticate" | `npm run db:verify` | Database schema might be missing |
| Invalid credentials | Check backend logs | `cd backend && npm run dev` |
| CORS error | Check browser console | Ensure cors() middleware in server.ts |
| Token not stored | Check browser localStorage | Open DevTools → Application → Local Storage |
| Protected routes 401 | Check Authorization header | Token format: `Bearer {token}` |

---

## 📈 Performance Notes

- **Login time**: 100-200ms (bcrypt hashing takes time - this is normal/secure)
- **Token validation**: <10ms per request
- **Database query**: <5ms (with index on username)
- **JWT generation**: <5ms

---

## 🔐 Security Checklist

✅ Passwords hashed with bcryptjs (10 rounds)  
✅ No plaintext passwords in logs  
✅ JWT tokens signed with secret key  
✅ 8-hour token expiration  
✅ CORS enabled for development  
✅ Database credentials in environment variables  
✅ Sensitive errors not returned to client  

⚠️ Before production:
- [ ] Change JWT_SECRET to strong random value
- [ ] Update default admin password
- [ ] Enable HTTPS
- [ ] Restrict CORS to specific origins
- [ ] Use database SSL connections
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Setup error monitoring

---

## 📚 Additional Resources

| Document | Purpose |
|----------|---------|
| [AUTHENTICATION_FIX_SUMMARY.md](AUTHENTICATION_FIX_SUMMARY.md) | Complete fix overview and build validation |
| [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) | Setup instructions and credentials |
| [AUTHENTICATION_DEBUGGING.md](AUTHENTICATION_DEBUGGING.md) | Detailed troubleshooting guide |

---

**Status**: ✓ READY TO USE  
**Version**: 1.0.0  
**Last Updated**: 2025-09-02
