# OgaBook Admin - All Routes

## Web Routes (EJS Pages)

| Route | Method | Description | Auth Required |
|-------|--------|-------------|---------------|
| `/` | GET | Dashboard page | Optional (client-side) |
| `/login` | GET | Login page | No |
| `/logout` | GET | Logout and redirect to login | No |
| `/users` | GET | Users management page | Optional (client-side) |
| `/subscriptions` | GET | Subscriptions management page | Optional (client-side) |
| `/tables` | GET | All database tables list | Optional (client-side) |
| `/tables/:tableName` | GET | Individual table viewer | Optional (client-side) |
| `*` | GET | Catch-all - redirects to login | No |

## API Routes

### Authentication

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Admin login |
| `/api/auth/verify` | GET | Verify JWT token |

### Database Management

| Route | Method | Description |
|-------|--------|-------------|
| `/api/database/tables` | GET | Get all tables |
| `/api/database/tables/:tableName/structure` | GET | Get table structure |
| `/api/database/tables/:tableName/data` | GET | Get table data (with pagination) |
| `/api/database/tables/:tableName/data/:id` | GET | Get single record |
| `/api/database/tables/:tableName/data` | POST | Create new record |
| `/api/database/tables/:tableName/data/:id` | PUT | Update record |
| `/api/database/tables/:tableName/data/:id` | DELETE | Delete record |
| `/api/database/query` | POST | Execute custom SQL query |

### System

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Health check |
| `/api` | GET | API information |

## Notes

- All web pages use client-side authentication (token stored in localStorage)
- API routes require JWT token in Authorization header: `Bearer <token>`
- Web pages will redirect to `/login` if token is missing or invalid
- 404 errors for API routes return JSON, web routes redirect to login

