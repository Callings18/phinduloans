

# Plan: Fix Collateral Multi-Image Upload + Streamline Borrower Flow

## Issues Identified

### Bug 1: Collateral Images -- Only 1 File Uploads
The `<Input type="file" multiple>` at Apply.tsx line 672-681 technically allows multi-select, but the HTML file input on some browsers shows only the last file name. More critically, the submit logic likely only uploads a single `collateral_image_url` column. Need to support up to 3 images properly.

### Issue 2: Borrower Flow is Too Open
Currently, unauthenticated users can navigate to `/apply` and see a full "please log in" page. The user wants:
- **Website** = marketing + calculator only. "Apply" buttons should redirect to `/auth` (login/signup), not `/apply`.
- **Borrower journey**: Sign up/Log in → Dashboard → Complete KYC → Apply from Dashboard
- `/apply` route should redirect authenticated users to `/dashboard` (where QuickApply calculator lives) and unauthenticated users to `/auth`
- Remove `/apply` as a standalone page -- the multi-step application form should live as a component accessible from the Dashboard

## Plan

### Task 1: Fix Collateral Multi-Image Upload (Apply.tsx)

- Replace the single `<Input type="file" multiple>` with a proper multi-file UI showing each selected image with a remove button, capped at 3
- Update the submit handler to upload all collateral images to storage and store URLs as a JSON array in `product_specific_data.collateral_image_urls`, plus set `collateral_image_url` to the first image

### Task 2: Redirect `/apply` to Auth/Dashboard

- Change `/apply` page to a simple redirect component:
  - Authenticated user → redirect to `/dashboard`
  - Unauthenticated user → redirect to `/auth?redirect=dashboard`
- Move the multi-step application form into a new component `src/components/dashboard/LoanApplicationForm.tsx`
- Render it from the Dashboard when user clicks "Apply Now" from QuickApply, or via a route like `/dashboard?apply=true&product={id}`

### Task 3: Update All "Apply Now" Links on Website

- **HeroSection.tsx**: Change `<Link to="/apply">` → `<Link to="/auth?mode=signup">` with label "Get Started"
- **CTASection.tsx**: Same change
- **LoanCalculator.tsx**: Change Apply button to link to `/auth?mode=signup` for unauthenticated, or `/dashboard` for authenticated
- **Navbar**: Update any "Apply" nav links

### Task 4: Simplify Public Routes

- Keep `/` (landing), `/calculator`, `/about`, `/auth` as public pages
- Remove or redirect `/pre-qualify` → `/auth`
- `/apply` becomes a redirect (Task 2)
- The actual application form only lives inside the authenticated Dashboard flow

### Summary of File Changes

| File | Change |
|------|--------|
| `src/pages/Apply.tsx` | Replace with redirect logic (auth or dashboard) |
| `src/components/dashboard/LoanApplicationForm.tsx` | **NEW** -- extract the multi-step form from Apply.tsx |
| `src/pages/Dashboard.tsx` | Add state/route param to show LoanApplicationForm |
| `src/components/home/HeroSection.tsx` | Change "Apply Now" → "Get Started" linking to `/auth` |
| `src/components/home/CTASection.tsx` | Same |
| `src/components/home/LoanCalculator.tsx` | Apply button → `/auth` or `/dashboard` |
| `src/components/dashboard/QuickApply.tsx` | "Apply" triggers in-dashboard application form |

This keeps the admin side completely untouched and makes the borrower journey: **Website → Sign Up → Dashboard → KYC → Apply**.

