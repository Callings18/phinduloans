# HR and Payroll System - Database Migration Required

## Migration File
**File:** `supabase/migrations/20260115_hr_payroll_system.sql`

## What This Migration Does
This migration creates a complete HR and Payroll management system for Phindu Loans' internal employees, fully compliant with Zambian labor and tax standards.

## Migration Details

### Tables Created:

1. **`employees`** - Internal employee records
   - Personal information (name, NRC, DOB, contact details)
   - Employment details (position, department, manager, start/end dates)
   - Zambian tax information (NAPSA number, Tax PIN, NHIMA number)
   - Banking details for salary payments
   - Emergency contact information

2. **`employee_salary_structure`** - Salary components and structure
   - Basic salary and allowances (housing, transport, meal, medical, etc.)
   - Statutory deductions (NAPSA, NHIMA)
   - Tax calculations (PAYE)
   - Other deductions (union dues, loans, etc.)
   - Calculated gross and net salary

3. **`payroll_periods`** - Payroll processing periods (legacy schema)
   - Period name, type (monthly, bi-weekly, weekly)
   - Start/end dates and pay date
   - Status tracking (draft, processing, approved, paid)
   - Totals (gross, deductions, net, employee count)
   - **App UI:** Admin HR and Admin Payroll use **`payroll_runs`** (month/year + totals) as the source of truth for displayed periods and exports. The `payroll_periods` table may remain for older data models but is not queried by the current admin screens.

4. **`payroll_records`** - Individual payroll records per employee per period
   - Salary components snapshot
   - Zambian statutory deductions (NAPSA, PAYE, NHIMA)
   - Other deductions (loans, advances, union dues)
   - Payment status and details
   - Calculated net salary

5. **`employee_leave`** - Leave management
   - Leave types (annual, sick, maternity, paternity, etc.)
   - Leave applications and approvals
   - Leave dates and duration

6. **`employee_leave_balances`** - Annual leave balances
   - Allocated, used, and balance days per leave type
   - Year-based tracking

### Zambian Compliance Features:

- **NAPSA (National Pension Scheme Authority)**
  - Employee contribution: 5% of gross (capped at K6,000)
  - Employer contribution: 5% of gross (capped at K6,000)
  - Automatic calculation in payroll

- **PAYE (Pay As You Earn) Tax**
  - ZRA tax brackets (2024 rates):
    - 0% on first K4,800
    - 25% on K4,800 - K7,000
    - 30% on K7,000 - K10,000
    - 37% on amounts above K10,000
  - Personal relief: K300/month
  - Automatic calculation

- **NHIMA (National Health Insurance Membership Authority)**
  - 1% contribution (configurable)
  - Automatic calculation

- **Zambian-Specific Fields**
  - NRC number (required, unique)
  - NAPSA membership number
  - ZRA Tax PIN
  - NHIMA number
  - Zambian provinces
  - Mobile money support for salary payments

## How to Apply

### Option 1: Using Supabase CLI (Recommended)
```bash
# Navigate to your project directory
cd "path/to/phinduloans"

# Apply the migration
supabase db push
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20260115_hr_payroll_system.sql`
4. Paste and execute the SQL

### Option 3: Direct SQL Execution
1. Connect to your Supabase database
2. Run the SQL commands from the migration file

## Verification

After applying the migration, verify it worked by running:

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

-- Check if indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'payroll_records', 'payroll_periods');

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('employees', 'payroll_records', 'payroll_periods');
```

## Impact

- **New Feature**: Complete HR and Payroll system for internal employees
- **No Breaking Changes**: All new tables, no modifications to existing tables
- **Zambian Compliance**: Fully compliant with NAPSA, ZRA, and NHIMA requirements
- **Role-Based Access**: Only admins and finance officers can manage payroll

## Features Enabled

After migration, you can:
1. **Add Employees** (`/admin/hr`)
   - Complete employee records with Zambian standards
   - NRC, NAPSA, Tax PIN, NHIMA numbers
   - Employment details and hierarchy

2. **Set Salary Structures** (via HR page - to be added)
   - Define salary components and allowances
   - Configure deductions
   - Automatic gross/net calculations

3. **Process Payroll** (`/admin/payroll`)
   - Create payroll periods
   - Process payroll for all active employees
   - Automatic Zambian tax calculations (NAPSA, PAYE, NHIMA)
   - Approve and mark as paid

4. **View Payroll Records**
   - Individual employee payroll details
   - Complete breakdown of earnings and deductions
   - Export capabilities

## Next Steps After Migration

1. **Add Employee Records**
   - Go to `/admin/hr`
   - Add your internal employees
   - Fill in all Zambian tax information

2. **Set Up Salary Structures**
   - For each employee, create a salary structure
   - Define basic salary and allowances
   - Configure deductions

3. **Process First Payroll**
   - Go to `/admin/payroll`
   - Create a payroll period
   - Process payroll (calculates all Zambian taxes automatically)
   - Review and approve

## Tax Rate Updates

**Important**: Tax rates are configured in `src/utils/zambianPayrollCalculations.ts`

- Update `PAYE_TAX_BRACKETS` if ZRA changes tax brackets
- Update `NAPSA_MAX_CONTRIBUTABLE` if NAPSA threshold changes
- Update `NHIMA_RATE` if NHIMA rate changes
- Update `PERSONAL_RELIEF_MONTHLY` if personal relief changes

These should be reviewed annually or when ZRA/NAPSA/NHIMA announce changes.

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Drop tables in reverse order (due to foreign keys)
DROP TABLE IF EXISTS public.employee_leave_balances CASCADE;
DROP TABLE IF EXISTS public.employee_leave CASCADE;
DROP TABLE IF EXISTS public.payroll_records CASCADE;
DROP TABLE IF EXISTS public.payroll_periods CASCADE;
DROP TABLE IF EXISTS public.employee_salary_structure CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS public.generate_employee_number();
```

**Warning**: This will delete all HR and Payroll data. Only use if absolutely necessary.

## Notes

- Employee numbers are auto-generated in format: `PHINDU-0001`, `PHINDU-0002`, etc.
- All salary calculations use Zambian Kwacha (ZMW)
- Tax calculations are based on 2024 ZRA rates - update annually
- NAPSA contributions are capped at K6,000 gross salary (as of 2024)
- The system supports both bank transfers and mobile money for salary payments
- Leave management is included for future use

---

**Migration Created:** 2026-01-15  
**Status:** Ready to apply  
**Priority:** High (required for HR and Payroll features to work)  
**Compliance:** Zambian labor and tax standards (NAPSA, ZRA, NHIMA)
