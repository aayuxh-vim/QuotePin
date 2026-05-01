# Deployment (Vercel) + Security

This project is designed to deploy on **Vercel** with **Supabase Auth** and **Supabase Postgres** (via Prisma).

## 1) Supabase settings

### Auth URL configuration

In Supabase Dashboard → **Authentication → URL Configuration**

- **Site URL**: `https://<your-vercel-project>.vercel.app`
- **Redirect URLs**: add at least:
  - `https://<your-vercel-project>.vercel.app/*`
  - `https://<your-vercel-project>.vercel.app/auth`

## 2) Vercel project setup

1. In Vercel, **New Project** → import GitHub repo `aayuxh-vim/QuotePin` (branch `master`).
2. Framework: **Next.js** (auto-detected)
3. Build Command: `npm run build`
4. Output: default

## 3) Environment variables (Vercel)

Set these in Vercel → **Project Settings → Environment Variables**:

### Required

- **`DATABASE_URL`**
  - Use the **Supabase Pooler** connection string (IPv4 compatible).
  - Ensure it includes `sslmode=require` if not already present.
- **`NEXT_PUBLIC_SUPABASE_URL`**
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**

### Optional

- **`SUPABASE_SERVICE_ROLE_KEY`**
  - Only needed if you later add server-side Supabase admin actions.
  - Never expose this in the client (no `NEXT_PUBLIC_` prefix).

### Rate limiting (strict)

If rate limiting is enabled, you’ll also need:

- **`UPSTASH_REDIS_REST_URL`**
- **`UPSTASH_REDIS_REST_TOKEN`**

## 4) Database migration

After first deploy (or locally), apply schema to Postgres:

```bash
npm run db:push
npm run db:generate
```

## 5) Share links behavior

- App + APIs require login.
- **Anonymous access is allowed only for** view-only share links:
  - `GET /api/share/[token]`
  - `GET /share/[token]`

