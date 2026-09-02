# RoboPulse Authentication Debugging Guide

## Quick Diagnosis Checklist

Use this guide to diagnose login issues systematically.

### Step 1: Verify Backend is Running
```bash
curl http://localhost:5000/api/health
```

**Expected response**:
```json
{
  "success": true,
  "service": "RoboPulse API",
  "status": "operational",
  "timestamp": "2026-09-02T..."
}
```

**If connection refused**:
- Backend not running: `cd backend && npm run dev`
- Wrong port: Check `backend/.env` PORT variable
- Firewall blocked: Check Windows Firewall settings

---

### Step 2: Verify Frontend is Running
```bash
curl http://localhost:5173
```

**Expected response**: HTML page (check that it loads)

**If connection refused**:
- Frontend not running: `cd frontend && npm run dev`
- Wrong port: Check `frontend/vite.config.ts`

---

### Step 3: Test Authentication Endpoint Directly
```bash
# Test with correct credentials
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

**Expected response** (successful):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "40000000-0000-0000-0000-000000000001",
    "username": "admin",
    "role": "admin"
  }
}
```

**If "Unable to authenticate user"**:
- Database issue: See Step 5
- Bcrypt hash corrupted: See Step 6

**If "Invalid username or password"**:
- User doesn't exist: Run migrations
- Password hash wrong: Check Step 6

---

### Step 4: Verify CORS Configuration
```bash
curl -X OPTIONS http://localhost:5000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"
```

**Expected headers in response**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

**If CORS errors**:
- Backend has `app.use(cors())` before routes? Check `backend/src/server.ts`

---

### Step 5: Verify Database Connection
```bash
# From project root
npm run db:verify
```

**Expected output**:
```
✓ Connected to PostgreSQL
✓ users table exists
✓ admin user found
```

**If connection fails**:
```bash
# Check docker containers running
docker ps | grep robopulse

# View PostgreSQL logs
docker-compose logs postgres

# Restart containers
docker-compose down -v
docker-compose up -d
sleep 3
npm run db:migrate
```

---

### Step 6: Verify Admin User in Database
```bash
# Connect to PostgreSQL directly
docker exec -it robopulse-postgres psql -U robopulse_user -d robopulse -c "SELECT id, username, role FROM users WHERE username='admin';"
```

**Expected output**:
```
                  id                  | username | role
--------------------------------------+----------+-------
 40000000-0000-0000-0000-000000000001 | admin    | admin
(1 row)
```

**If no rows returned**:
- Migrations not applied: `npm run db:migrate`
- Wrong database: Check `backend/.env` DATABASE_NAME

---

### Step 7: Verify Bcrypt Hash
```bash
# Test if the stored hash matches password "admin"
cd backend
node -e "
const bcrypt = require('bcryptjs');
const hash = '\$2b\$10\$6bzDSQLrStdHEAs6L3SGC.0YmKjwJL9KnQMVZSm85evTzDFYnIwz6';
bcrypt.compare('admin', hash, (err, res) => {
  console.log('Hash matches admin password:', res);
});
"
```

**Expected output**:
```
Hash matches admin password: true
```

**If false**:
- Hash is corrupted or wrong password
- Rebuild database: `docker-compose down -v && docker-compose up -d && npm run db:migrate`

---

### Step 8: Check Frontend Network Tab
In browser DevTools (F12):
1. Go to Network tab
2. Attempt login
3. Find POST request to `auth/login`
4. Check:
   - **Request**: Shows `username` and `password` in body?
   - **Response**: 200 status with token? Or 401/500?
   - **Headers**: Shows `Content-Type: application/json`?

---

## Backend Logs Interpretation

### Expected startup logs:
```
✓ PostgreSQL connection established
✓ Database schema verified
✓ Redis connection established
✓ RoboPulse API running on http://localhost:5000
```

### If you see "users table not found":
```
❌ SCHEMA ERROR: 'users' table not found
   Run: npm run db:migrate
```

### If you see "Auth Controller Login error":
Check the line after for the actual error:
- `Database query failed: ...` → PostgreSQL issue
- `Bcrypt comparison failed: ...` → Hash corruption
- `User not found: admin` → Migrations not run

---

## Complete Reset (Nuclear Option)

If all else fails:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove node_modules if npm issues
rm -rf node_modules backend/node_modules frontend/node_modules

# Reinstall dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Restart from scratch
docker-compose up -d
sleep 5
npm run db:migrate
npm run db:verify

# Start services
cd backend && npm run dev  # In terminal 1
cd frontend && npm run dev  # In terminal 2
```

Then test login at http://localhost:5173 with `admin` / `admin`.

---

## Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Unable to authenticate user` | Database unreachable | Restart PostgreSQL container |
| `Invalid username or password` | Wrong credentials or user missing | Run `npm run db:migrate` |
| `Cannot connect to RoboPulse API` | Backend not running | `cd backend && npm run dev` |
| `CORS error` | Frontend origin not allowed | Check `backend/src/server.ts` has `cors()` |
| `Cannot find module './api/auth'` | Frontend auth file missing | Run `npm run build` in frontend |
| `JWT Error` | Token corrupted or expired | Clear localStorage and re-login |

---

## Performance Troubleshooting

### Slow login (>3 seconds)
- Bcrypt verification takes time (normal: 100-200ms)
- Check database query time: see `[Auth Service]` logs
- May indicate slow network or PostgreSQL performance

### High CPU during login
- Bcrypt by design is CPU-intensive for security
- Should return to normal after login completes

---

## Production Considerations

- **Change JWT_SECRET**: Use strong random string in `backend/.env`
- **Update default password**: Create new admin user, delete default
- **Use HTTPS**: Update `VITE_API_BASE_URL` to `https://...`
- **Use httpOnly cookies**: Store token securely (not localStorage)
- **Enable database SSL**: Connection string with `sslmode=require`
- **Implement rate limiting**: Prevent brute-force attacks
- **Add 2FA**: Optional second authentication factor

---

## Testing Credentials

**Development Admin**:
- Username: `admin`
- Password: `admin`

**DO NOT USE IN PRODUCTION** - Generate strong random credentials before deployment.
