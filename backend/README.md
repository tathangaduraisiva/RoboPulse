# RoboPulse Backend

## Local development authentication

The local development admin account is intentionally simple for easy local setup and testing.

- Username: `admin`
- Password: `admin`
- Role: `admin`

This account is created via the existing migration/seed flow and stored with a bcrypt hash in PostgreSQL. It is only intended for local development and must not be used in production.

## Login endpoint

POST http://localhost:5000/api/auth/login

Request body:

```json
{
  "username": "admin",
  "password": "admin"
}
```

Successful response:

```json
{
  "success": true,
  "token": "...",
  "user": {
    "id": "...",
    "username": "admin",
    "role": "admin"
  }
}
```

## Notes

- Blank username and blank password are rejected.
- Wrong password returns HTTP 401.
- Passwords are never stored or compared in plaintext.
- Full auth behavior is enforced in the backend, not in the frontend.
