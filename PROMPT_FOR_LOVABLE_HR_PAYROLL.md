# Prompt for Lovable AI - HR and Payroll System Deployment

Copy and paste this prompt to Lovable:

---

## 🚀 Deploy HR and Payroll Management System

A complete HR and Payroll management system has been implemented and pushed to the repository. Please deploy it to production.

### Actions Required:

1. **Run Database Migration:**
   ```bash
   supabase db push
   ```
   Or specifically apply the migration:
   ```bash
   psql -h <db-host> -U postgres -d postgres -f supabase/migrations/20260115_hr_payroll_system.sql
   ```

2. **Build and Deploy Frontend:**
   ```bash
   npm install
   npm run build
   # Deploy dist folder
   ```

### What Was Added:

**New Files:**
- `src/pages/admin/AdminHR.tsx` - HR management page for employee records
- `src/pages/admin/AdminPayroll.tsx` - Payroll processing page with Zambian tax calculations
- `src/utils/zambianPayrollCalculations.ts` - Zambian tax calculation utilities (NAPSA, PAYE, NHIMA)
- `supabase/migrations/20260115_hr_payroll_system.sql` - Complete HR and Payroll database schema

**Modified Files:**
- `src/App.tsx` - Added routes for `/admin/hr` and `/admin/payroll`
- `src/components/admin/AdminSidebar.tsx` - Added "HR & Payroll" section to navigation
- `src/pages/admin/AdminEmployers.tsx` - Updated title to clarify it's for external employers

**Documentation:**
- `HR_PAYROLL_MIGRATION_PROMPT.md` - Complete migration documentation
- `PROMPT_FOR_LOVABLE_HR_PAYROLL.md` - This file

### Database Tables Created:

1. **`employees`** - Internal employee records with Zambian standards
2. **`employee_salary_structure`** - Salary components and deductions
3. **`payroll_periods`** - Payroll processing periods
4. **`payroll_records`** - Individual payroll records per employee
5. **`employee_leave`** - Leave management
6. **`employee_leave_balances`** - Annual leave balances

### Features Deployed:

✅ Complete employee management (CRUD operations)
✅ Zambian tax compliance (NAPSA, PAYE, NHIMA)
✅ Automatic payroll calculations
✅ Payroll period management
✅ Salary structure management
✅ Leave management (ready for future use)
✅ Role-based access control (admin/finance only)
✅ Auto-generated employee numbers (PHINDU-0001, etc.)

### Zambian Compliance:

- **NAPSA**: 5% employee/employer contributions (capped at K6,000)
- **PAYE**: ZRA tax brackets with personal relief (K300/month)
- **NHIMA**: Health insurance contributions (1%)
- **NRC Numbers**: Required and validated
- **Zambian Provinces**: Dropdown selection
- **Mobile Money**: Support for salary payments

### Post-Deployment:

After deployment, admins should:

1. Navigate to **Admin → HR Management** (`/admin/hr`)
   - Add internal employees
   - Fill in Zambian tax information (NRC, NAPSA, Tax PIN, NHIMA)
   - Set up employee records

2. Navigate to **Admin → Payroll** (`/admin/payroll`)
   - Create payroll periods
   - Set up salary structures for employees
   - Process payroll (automatic Zambian tax calculations)

### Verification:

After deployment, verify the migration ran successfully:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'employees', 
  'employee_salary_structure', 
  'payroll_periods', 
  'payroll_records',
  'employee_leave',
  'employee_leave_balances'
);

-- Should return 6 rows
```

### Important Notes:

- **No Breaking Changes**: All new tables, no modifications to existing tables
- **Zero Downtime**: Migration can run while system is live
- **Backward Compatible**: Existing functionality unaffected
- **Admin Only**: HR and Payroll features are admin-only (RLS policies enforced)

### Troubleshooting:

**If Migration Fails:**

```bash
# Check migration syntax
psql -h <host> -U postgres -d postgres --echo-errors -f supabase/migrations/20260115_hr_payroll_system.sql

# If triggers don't exist, ensure update_updated_at_column() function exists
# (Should be in earlier migrations)

# Check for foreign key constraints
SELECT conname, conrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f' 
AND conrelid::regclass::text LIKE '%employee%';
```

**If Frontend Build Fails:**

```bash
# Check for TypeScript errors
npm run type-check

# Clear cache and rebuild
rm -rf node_modules/.vite
npm run build
```

### Success Criteria:

✅ Migration runs without errors
✅ All 6 tables created successfully
✅ RLS policies applied correctly
✅ Frontend builds without errors
✅ Admin can access `/admin/hr` page
✅ Admin can access `/admin/payroll` page
✅ No console errors in browser
✅ Employee number generation works

---

**Deployment Complexity**: Low  
**Risk Level**: Low (new tables only, no breaking changes)  
**Testing Required**: Medium (test employee creation and payroll processing)

**Deployment Date**: January 15, 2026  
**Version**: 1.0  
**Status**: Ready for Deployment ✅
