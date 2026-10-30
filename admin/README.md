# TownServices Admin

Admin dashboard (Vite + React + TypeScript + react-admin v5 + recharts) for the TownServices NestJS API.

## Run

```bash
cp .env.example .env      # set VITE_API_URL (default http://localhost:4000/api/v1)
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check + production build into dist/
```

The backend must allow the origin in `CORS_ORIGINS` (e.g. `http://localhost:5173`).
Only users with role `ADMIN` or `SUPER_ADMIN` can sign in. Settings writes, role changes and
admin creation are available to `SUPER_ADMIN` only.

## Docker

```bash
docker build -t townservices-admin --build-arg VITE_API_URL=https://api.example.com/api/v1 .
docker run -p 8080:80 townservices-admin
```
