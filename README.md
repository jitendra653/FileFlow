Rdx_prject

Scaffolded TypeScript + Express backend for the file upload service described in `PROJECT_SPECIFICATION.md`.

Quick start (Windows PowerShell):

1. Install dependencies:

```powershell
npm install
```

2. Start in development mode:

```powershell
npm run dev
```

Notes:
- This is an initial scaffold. Run `npm install` to fetch dependencies and type definitions required by TypeScript.
- Environment variables: create a `.env` file with `MONGO_URI` and other secrets.

Docker (optional):

Start app + MongoDB with Docker Compose:

```powershell
docker compose up --build
```

This will expose the API at http://localhost:3000 and MongoDB at port 27017.

API docs are available at: http://localhost:3000/docs

Try it (PowerShell)

1. Start the server (locally or with Docker Compose):

```powershell
npm run dev
# or
docker compose up --build
```

2. Create a dev user and get a JWT:

```powershell
# using the dev admin route
curl -X POST http://localhost:3000/admin/seed -H "Content-Type: application/json" -d '{"email":"dev@example.com"}'

# or generate locally
node .\scripts\create-token.js dev-user-id
```

3. Upload a file (replace <JWT> and <filePath>):

```powershell
$jwt = "<JWT>"
curl -X POST http://localhost:3000/upload -H "Authorization: Bearer $jwt" -F "file=@C:\path\to\image.png" -H "x-category: avatars"
```

4. Generate a temporary download token for a file (use fileId from upload response):

```powershell
curl -X POST http://localhost:3000/files/generate-token -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" -d '{"fileId":"<FILE_ID>","expiresIn":"5m"}'
```

5. Download using token:

```powershell
curl "http://localhost:3000/files/download?token=<TOKEN>" --output downloaded.png
```

6. Transform image (resize & convert):

```powershell
curl "http://localhost:3000/transform?fileId=<FILE_ID>&width=200&height=200&format=webp" --output thumb.webp
```

