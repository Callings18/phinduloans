# 🔍 Loan Product Engine - Gap Analysis Report

**Analysis Date:** January 3, 2026  
**Current Status:** Partially Implemented - Requires Enhancements

---

## 📊 Executive Summary

The current PhinduLoans system has a **solid foundation** for loan product management with many configurable parameters already in place. However, there are several critical gaps when compared to the comprehensive requirements for a fully dynamic loan engine.

### Overall Implementation Score: **65/100**

| Category | Current State | Target State | Gap |
|----------|--------------|--------------|-----|
| Basic Product Config | ✅ 90% | 100% | Minor |
| Interest Configuration | ✅ 85% | 100% | Minor |
| Fees & Deductions | ⚠️ 60% | 100% | **Medium** |
| Loan Term Configuration | ⚠️ 50% | 100% | **Medium** |
| Document Management | ❌ 30% | 100% | **Critical** |
| Approval Workflow | ❌ 20% | 100% | **Critical** |
| Formula Builder | ❌ 0% | 100% | **Critical** |
| Calculation Validation | ⚠️ 70% | 100% | Medium |

---

## ✅ WHAT'S ALREADY IMPLEMENTED

### 1. Loan Product Creation (Admin) - **WELL IMPLEMENTED**

**A. Basic Details** ✅
- ✅ Loan Product Name
- ✅ Loan Product Code
- ✅ Description
- ✅ Channels (website, admin, ussd, partner)
- ✅ Status (active, inactive, archived)
- ⚠️ Target Customer Type - Missing (only employment_types exist)
- ⚠️ Loan Category - Missing (Personal, SME, Salary-Based, etc.)

**B. Principal Rules** ✅
- ✅ Minimum Loan Amount
- ✅ Maximum Loan Amount
- ⚠️ Step Amounts - Not implemented
- ✅ Currency (ZMW assumed, not configurable)

**C. Interest Configuration** ✅
- ✅ Interest Type: flat, reducing_balance, compound
- ✅ Interest Period: daily, weekly, monthly, yearly
- ✅ Interest Rate Value (configurable)
- ✅ `loanCalculations.ts` has proper normalization:
  - `normalizeToMonthlyRate()` - Converts any period to monthly
  - `calculateFlatInterest()` - Flat rate calculation
  - `calculateReducingBalancePayment()` - Amortization formula

**D. Fees & Deductions** ⚠️ PARTIAL
- ✅ Processing Fee (percentage)
- ✅ Enforcement/Legal Fee (percentage)
- ✅ Insurance Premium (percentage)
- ✅ VAT (percentage)
- ✅ Platform Fee (percentage)
- ✅ Late Payment Penalty (percentage + frequency)
- ✅ Early Repayment Fee (percentage)
- ❌ Fixed amount fees - Not supported (only percentages)
- ❌ CRB Check Fee - Not implemented
- ❌ Fee visibility on borrower agreement - Not configurable
- ❌ Deduct upfront vs added to repayment - Hardcoded (upfront only)

### 2. Loan Term Configuration ⚠️ PARTIAL

- ✅ Min/Max Term in Months
- ✅ Repayment Frequency (monthly, bi-weekly, weekly)
- ✅ Installment Structure (equal, balloon, bullet)
- ❌ Duration Value + Unit (Days/Weeks/Months/Years) - Uses months only
- ❌ One-time repayment mode - Not supported
- ❌ Custom schedule builder - Not implemented

### 3. Eligibility Rules ✅ GOOD

- ✅ Min/Max Age
- ✅ Min Salary
- ✅ Max Salary Percent
- ✅ Max DTI Ratio
- ✅ Min Credit Score
- ✅ Max Concurrent Loans
- ✅ Employment Types
- ✅ Blacklist Check Required flag
- ✅ MOU Required flag
- ✅ Employer Whitelist Enabled flag

### 4. CRB & Guarantee ✅ GOOD (DB Schema Ready)

- ✅ crb_check_required
- ✅ crb_auto_decline_score
- ✅ crb_manual_review_score
- ✅ crb_auto_approve_score
- ✅ guarantee_required
- ✅ guarantee_provider
- ✅ max_guarantee_percent
- ✅ guarantee_fee_percent
- ⚠️ CRB API Integration - Toggle-ready but not implemented

### 5. Calculation Engine ✅ GOOD

`src/utils/loanCalculations.ts` has:
- ✅ Interest period normalization
- ✅ Flat interest calculation
- ✅ Reducing balance (amortization)
- ✅ Fee calculations (processing, insurance, VAT, platform)
- ✅ Disbursement amount (after fees)
- ✅ Penalty calculation with grace period
- ✅ Early settlement calculation
- ✅ Repayment schedule generation

---

## ❌ GAPS - WHAT'S MISSING

### 1. 🔴 CRITICAL: Custom Formula Builder

**Current State:** Hardcoded calculation logic in `loanCalculations.ts`

**Required:**
- Admin-defined formulas using variables:
  - `principal`, `interest_rate`, `loan_term`, `term_unit`
  - `processing_fee`, `enforcement_fee`, `insurance_fee`
  - `penalty_fee`, `total_interest`, `total_payable`
- Formula preview/testing with sample amounts
- Lock formula per product

**Implementation Need:**
- New DB column: `calculation_formula` (JSONB)
- Formula parser/evaluator component
- Admin UI for formula builder
- Test calculator preview

---

### 2. 🔴 CRITICAL: Document Management Per Product

**Current State:** 
- Documents linked to loan applications (NRC, payslips, bank statements)
- Hardcoded document types in Apply.tsx
- No per-product configuration

**Required:**
- Per-product required documents list
- For each document:
  - Mandatory vs Optional
  - File type restrictions
  - Max file size
  - Validity period
  - Reuse from previous loans flag
- Admin document review workflow with approve/reject + comments

**Implementation Need:**
- New table: `loan_product_documents`
- UI for configuring documents per product
- Document review queue in admin

---

### 3. 🔴 CRITICAL: Configurable Approval Workflow

**Current State:**
- Fixed statuses: pending, under_review, approved, rejected, disbursed, active, completed, defaulted
- No configurable stages per product
- No role-based stage permissions
- No automated triggers

**Required:**
- Configurable stages per product:
  - Draft, Submitted, Document Review, CRB Check, Risk Review, Approved, Disbursed, Active, Due, Overdue, Defaulted, Closed, Written-Off
- Role permissions per stage
- Required actions per stage
- Automated triggers (move to next stage, send notifications)

**Implementation Need:**
- New tables: `workflow_stages`, `workflow_transitions`, `workflow_permissions`
- Workflow builder UI
- State machine logic for stage transitions

---

### 4. 🟠 MEDIUM: Fee Flexibility

**Current State:**
- All fees are percentage-based
- All upfront-deducted fees hardcoded

**Required:**
- Fixed amount OR percentage per fee
- Deduct upfront OR add to repayment (configurable per fee)
- Visibility on borrower agreement toggle

**Implementation Need:**
- Add columns: `processing_fee_type` (fixed/percent), `processing_fee_deduction` (upfront/repayment)
- Update calculation engine
- Update contract generation

---

### 5. 🟠 MEDIUM: Loan Term Flexibility

**Current State:**
- Term only in months
- Monthly, bi-weekly, weekly frequencies

**Required:**
- Duration Value (e.g., 7, 14, 30, 90, etc.)
- Duration Unit (days, weeks, months, years)
- Repayment Mode: one-time, weekly, monthly, custom schedule

**Implementation Need:**
- Add columns: `term_unit` (days/weeks/months/years)
- Update schedule generation for non-monthly terms
- Custom schedule builder UI

---

### 6. 🟠 MEDIUM: Loan Category/Type

**Current State:** No loan category classification

**Required:**
- Loan Category: Personal, SME, Salary-Based, Asset-Backed, Emergency, Group, etc.

**Implementation Need:**
- Add column: `category`
- Update filters and reports

---

### 7. 🟡 LOW: Calculation Preview

**Current State:**
- No in-admin calculation preview when creating/editing products
- Calculator exists on public page

**Required:**
- Preview calculations with sample amounts within product form
- Test before saving

**Implementation Need:**
- Add "Test Calculation" section to AdminLoanProducts.tsx
- Use existing `calculateLoan()` function

---

## 📋 IMPLEMENTATION PLAN

### Phase 1: Quick Wins (1-2 Days)
1. ✅ Add Loan Category field
2. ✅ Add Calculation Preview in product form
3. ✅ Add fixed/percentage toggle for fees
4. ✅ Add term_unit field (days/weeks/months/years)

### Phase 2: Document Management (2-3 Days)
1. Create `loan_product_documents` table
2. Build document configuration UI
3. Update loan application to use product-specific documents
4. Add document review workflow

### Phase 3: Approval Workflow Engine (3-5 Days)
1. Design workflow tables
2. Build workflow stage configuration UI
3. Implement state machine for stage transitions
4. Add role-based permissions per stage
5. Implement automated triggers

### Phase 4: Formula Builder (3-4 Days)
1. Design formula schema (variables, operators)
2. Build formula parser/evaluator
3. Create formula builder UI with drag-and-drop or expression input
4. Add formula testing/preview
5. Integrate with calculation engine

### Phase 5: Advanced Features (Ongoing)
1. CRB API integration
2. PMIC insurance integration
3. Enhanced reporting per product
4. Audit trail for product changes

---

## 🎯 NEXT STEPS

1. **Confirm priority** - Which gaps are most critical for immediate business needs?
2. **Start Phase 1** - Quick wins can be implemented today
3. **Plan database migrations** for new tables/columns
4. **Design UI mockups** for complex features (workflow builder, formula builder)

---

*Generated by Anti-Gravity Analysis Engine*
