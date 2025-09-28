

# FileFlow Project

## Overview
FileFlow is a full-stack file/image management platform for secure file and image uploads, expiring links, analytics, admin panel, and a modern React dashboard. Built with Node.js, Express, TypeScript, MongoDB, and React (Vite + Tailwind).

---

## API Documentation

Explore and test all API endpoints using the built-in documentation:

- **Redoc UI:** [http://localhost:3000/v1/docs](http://localhost:3000/v1/docs)
- **OpenAPI JSON:** [http://localhost:3000/v1/docs/openapi.json](http://localhost:3000/v1/docs/openapi.json)

> If you see a 404 or blank page, ensure the backend is running and you are using the correct `/v1/docs` path.

### How to Explore the API
1. Start the backend server (see Quick Start below).
2. Open [http://localhost:3000/v1/docs](http://localhost:3000/v1/docs) in your browser.
3. Use the Redoc UI to view all endpoints, parameters, and responses.
4. For direct OpenAPI JSON, use `/v1/docs/openapi.json`.

---

---

## Features

### Backend (Node.js + Express + TypeScript)
- **User Authentication & Authorization**: JWT-based, role-based (user/admin/superadmin), API key support, session handling, password hashing
- **File Management**: Secure uploads (multer), per-user storage, file categorization, download token generation, expiring URLs, file metadata, quotas
- **Image Transformations**: Resize, crop, format conversion (Sharp), serve transformed images on-the-fly
- **Temporary & Secure File Access**: Expiring download links (JWT/HMAC), token validation middleware
- **Admin Panel**: User management, quota resets, suspend/reactivate users, usage stats, analytics, logs
- **Analytics & Monitoring**: Track uploads/downloads/transformations, Prometheus metrics, health checks, system dashboard
- **Webhooks**: User-configurable webhook endpoints for file events
- **Security**: Input validation, rate limiting, centralized error handling, logging, 2FA, IP whitelisting, security dashboards
- **API Documentation**: OpenAPI/Swagger docs auto-synced with backend routes

### Frontend (React + Vite + Tailwind)
- **Modern Dashboard**: File upload, download, management UI, real-time analytics/notifications (WebSocket), user profile, plan management, settings
- **Authentication**: Login, registration, 2FA, password reset
- **Admin Features**: Admin dashboard, user management, analytics
- **Responsive Design**: Mobile-friendly, accessible UI

### DevOps & Tooling
- **Dockerized Setup**: Docker Compose for backend, frontend, MongoDB
- **Testing**: Jest integration, route/integration tests
- **Monitoring**: Prometheus metrics, health endpoints
- **Extensible**: Modular codebase, clear separation of concerns

---


## Quick Start

### Backend Setup
1. Install dependencies:
	```powershell
	npm install
	```
2. Start in development mode:
	```powershell
	npm run dev
	```
3. Create a `.env` file with `MONGO_URI` and other secrets.

### Docker (optional)
Start app + MongoDB with Docker Compose:
```powershell
docker compose up --build
```
API: http://localhost:3000  |  MongoDB: port 27017

### Example Usage
1. Start the server (locally or with Docker Compose):
	```powershell
	npm run dev
	# or
	docker compose up --build
	```
2. Create a dev user and get a JWT:
	```powershell
	curl -X POST http://localhost:3000/v1/admin/seed -H "Content-Type: application/json" -d '{"email":"dev@example.com"}'
	# or generate locally
	node .\scripts\create-token.js dev-user-id
	```
3. Upload a file:
	```powershell
	$jwt = "<JWT>"
	curl -X POST http://localhost:3000/v1/upload -H "Authorization: Bearer $jwt" -F "file=@C:\path\to\image.png" -H "x-category: avatars"
	```
4. Generate a temporary download token:
	```powershell
	curl -X POST http://localhost:3000/v1/files/generate-token -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" -d '{"fileId":"<FILE_ID>","expiresIn":"5m"}'
	```
5. Download using token:
	```powershell
	curl "http://localhost:3000/v1/files/download?token=<TOKEN>" --output downloaded.png
	```
6. Transform image (resize & convert):
	```powershell
	curl "http://localhost:3000/v1/transform?fileId=<FILE_ID>&width=200&height=200&format=webp" --output thumb.webp
	```
---

## How to Contribute

1. Fork this repository and clone your fork.
2. Create a new branch for your feature or bugfix.
3. Make your changes and add tests if needed.
4. Submit a pull request with a clear description.

---

## Support

For questions, issues, or feature requests, please open an issue in this repository.

---

---

## Project Structure & File Mappings

### Authentication & Authorization
- `src/middleware/auth.ts`: JWT validation, role checking
- `src/middleware/adminAuth.ts`: Admin-specific auth checks
- `src/routes/auth.ts`: Login/register endpoints
- `src/models/user.ts`: User schema with roles

### File Management
- `src/routes/files.ts`: File operations
- `src/routes/upload.ts`: Upload handling
- `src/models/file.ts`: File metadata schema
- `src/utils/fileToken.ts`: Temporary file access tokens

### Express.js Framework
- Structured routing, middleware, request validation, API versioning, static file serving

### Database
- MongoDB with Mongoose, schemas/models, CRUD, aggregation, indexing, Docker setup

### Testing & Debugging
- Jest, integration tests, error logging (Winston), custom error middleware, Prometheus metrics

### Performance & Security
- Rate limiting (Redis), input validation, password hashing, environment variable management

---
