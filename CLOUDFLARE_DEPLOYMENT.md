# Cloudflare Deployment Guide

This repository is configured for deployment to Cloudflare Pages using Git integration.

## Prerequisites

1. Install dependencies:
```bash
npm install
```

## Git Integration Setup

For automatic deployments with environment variables, connect your GitHub repository to Cloudflare Pages.

### Staff Web App Configuration

When creating the Pages project in Cloudflare dashboard, use these settings:

- **Framework preset**: None (or "Other")
- **Build command**: `npm run build -w apps/staff-web`
- **Build output directory**: `apps/staff-web/dist`
- **Root directory**: `/` (repository root)

### Borrower Mobile App Configuration

When creating the Pages project in Cloudflare dashboard, use these settings:

- **Framework preset**: None (or "Other")
- **Build command**: `npm run build -w apps/borrower-mobile`
- **Build output directory**: `apps/borrower-mobile/dist`
- **Root directory**: `/` (repository root)

**Important**: Since this is a monorepo, Cloudflare's framework detection may fail. Use "None" or "Other" as the framework preset to avoid detection issues.

### Environment Variables for Git Integration

Configure these in Cloudflare Pages dashboard (Settings > Environment Variables):

#### Staff Web App
- `VITE_API_URL` - API endpoint URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_VAPID_PUBLIC_KEY` - Web push public key (optional)
- `VITE_BORROWER_WEB_INSTALL_GATE` - PWA install gate (true/false)

#### Borrower Mobile App
- `VITE_API_URL` - API endpoint URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_VAPID_PUBLIC_KEY` - Web push public key (optional)

## First-Time Setup

1. Go to Cloudflare Pages dashboard: https://dash.cloudflare.com/
2. Click "Create a project"
3. Select "Connect to Git"
4. Choose your GitHub repository (`Callings18/phinduloans`)
5. Create two separate projects with the configurations above
6. Configure environment variables in each project's Settings > Environment Variables

## Local Build Testing

To test builds locally before pushing:

```bash
npm run build:staff
npm run build:borrower
```

## Notes

- The borrower-mobile app is primarily designed for Capacitor (mobile apps), but can also be deployed as a PWA to Cloudflare Pages
- Ensure your Supabase configuration allows the Cloudflare Pages domain
- For production, configure custom domains in Cloudflare Pages dashboard
- Cloudflare will automatically deploy on every push to your connected branch
