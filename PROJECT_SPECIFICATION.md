Project Specification

Project: Rdx_prject

Overview:
This project supports automated coding assistance and workspace-oriented tooling. The project should include clear conventions for file edits, testing, and verification within the VS Code environment.

Goals:
### Day 1–2: Setup & Core Upload API
- [ ] Initialize Node.js + Express.js + TypeScript project
  <!-- Copilot hint: use `npx express-generator --typescript` or `ts-node-dev` -->
- [ ] Setup MongoDB (users, file metadata)
  <!-- Copilot hint: define `User` and `File` schemas using Mongoose -->
- [ ] Implement user authentication (API keys or JWT)
  <!-- Copilot hint: use `jsonwebtoken` package, add auth middleware -->
- [ ] Create file upload API endpoint
  <!-- Copilot hint: use `multer` for file upload, store in `uploads/userId/category/` -->
- [ ] Store files per user (`/uploads/userId/category/filename`)
  <!-- Copilot hint: create dynamic folder if not exists using `fs.mkdirSync` -->
- [ ] Validate file type & size
  <!-- Copilot hint: check `file.mimetype` and `file.size` -->

### Day 3–4: File Retrieval & Expiring URLs
- [ ] Create file retrieval API endpoint
  <!-- Copilot hint: use Express `res.sendFile(path)` -->
- [ ] Implement temporary expiring URL generation (JWT/HMAC)
  <!-- Copilot hint: use `jsonwebtoken.sign({ filePath }, secret, { expiresIn: '5m' })` -->
- [ ] Validate signed URLs on file download
  <!-- Copilot hint: `jwt.verify(token, secret)` in middleware -->
- [ ] Test expiring links via frontend or Postman
  <!-- Copilot hint: use browser or curl to check URL expiration -->

### Day 5: Basic Dashboard
- [ ] Setup React + Tailwind frontend
  <!-- Copilot hint: create `create-react-app` or Vite project -->
- [ ] User login page
  <!-- Copilot hint: connect to backend JWT auth API -->
- [ ] Upload page (with category selection)
  <!-- Copilot hint: POST to `/upload` endpoint with category param -->
- [ ] List files with download/expiring link buttons
  <!-- Copilot hint: GET `/files` endpoint, render `<img>` or `<a>` -->

### Day 6–7: Security & Error Handling
- [ ] Add input validation (file type, file size, category)
  <!-- Copilot hint: use `express-validator` or custom checks -->
- [ ] Centralized error handling middleware
  <!-- Copilot hint: Express `app.use((err, req, res, next) => {})` -->
- [ ] Logging (file upload/download errors)
  <!-- Copilot hint: use `winston` or `pino` -->
- [ ] HTTPS setup for development (self-signed cert)
  <!-- Copilot hint: `https.createServer({key, cert}, app)` -->
- [ ] Test security edge cases
  <!-- Copilot hint: try invalid files, expired URLs, unauthorized access -->

---

### Day 8–9: Image Transformations
- [ ] Add image transformation API (resize, crop, format conversion)
  <!-- Copilot hint: use `sharp` library -->
- [ ] Accept query parameters (`width`, `height`, `format`)
  <!-- Copilot hint: parse `req.query` and pass to `sharp().resize()` -->
- [ ] Serve transformed image without altering original
  <!-- Copilot hint: `sharp(input).resize().toBuffer()` and `res.type()` -->
- [ ] Unit tests for image transformations
  <!-- Copilot hint: use `jest` or `mocha` -->

### Day 10: Quotas & Plans
- [ ] Implement storage & API call quotas per user
  <!-- Copilot hint: store usage in DB, check before upload -->
- [ ] Store usage stats in database
  <!-- Copilot hint: increment fields on file upload/download -->
- [ ] Return proper error if quota exceeded
  <!-- Copilot hint: `res.status(403).json({ error: "Quota exceeded" })` -->
- [ ] Test quota enforcement for Free & Pro users

### Day 11: Analytics
- [ ] Track uploads, downloads, transformations per user
  <!-- Copilot hint: MongoDB collection `logs` or `usage` -->
- [ ] Build simple dashboard showing:
    - Storage used
    - API calls made
    - Popular file categories
  <!-- Copilot hint: React charts using `recharts` or `chart.js` -->

### Day 12: Webhooks
- [ ] Add webhook support for file upload/delete events
  <!-- Copilot hint: POST JSON payload to user-provided endpoint -->
- [ ] Allow users to set webhook endpoints
  <!-- Copilot hint: store endpoint in DB per user -->
- [ ] Send JSON payload with file details on events
  <!-- Copilot hint: include filename, URL, category, timestamp -->
- [ ] Test webhook delivery with Postman or ngrok

### Day 13: Admin Panel (Basic)
- [ ] Admin login page
  <!-- Copilot hint: separate route with JWT auth & admin role check -->
- [ ] View all users, usage stats, quotas
  <!-- Copilot hint: MongoDB aggregation for total storage/API usage -->
- [ ] Suspend or reactivate users
  <!-- Copilot hint: update `user.status` in DB -->
- [ ] Reset user quotas if needed
  <!-- Copilot hint: set `usage` fields to 0 -->

### Day 14: Polish & Deploy
- [ ] Dockerize backend + frontend
  <!-- Copilot hint: create `Dockerfile` for Node.js API and React frontend -->
- [ ] Nginx setup for reverse proxy & HTTPS
  <!-- Copilot hint: map `/api` and `/` routes to backend/frontend -->
- [ ] Deploy on VPS
  <!-- Copilot hint: Ubuntu server, Docker Compose, SSL certs -->
- [ ] Test all core APIs and dashboard functionality
  <!-- Copilot hint: curl, Postman, browser testing -->
- [ ] Final QA and bug fixing
  <!-- Copilot hint: log all errors, test edge cases -->


Deliverables:
- Source code and tests.
- Documentation including this project specification.
- Optional templates for CI, linting, and testing.

Assumptions:
- Workspace root: c:\\Users\\Vijesh\\Desktop\\Rdx_prject
- Default shell: Windows PowerShell

Verification:
- Files created will be read back to verify content.

