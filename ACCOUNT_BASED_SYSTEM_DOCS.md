# Account-Based Financial Management System
## Complete Implementation Documentation

---

## 🎯 Overview

The Phindu Loans system now operates as a **complete account-based financial management platform**. Every single financial transaction is tracked through specific accounts, ensuring:

- **100% Transparency**: Every ZMW is accounted for
- **Real-time Balance Updates**: Instant reflection of all transactions
- **Prevents Overdrafts**: Automatic validation before allowing transactions
- **Full Audit Trail**: Complete transaction history in `account_transactions`
- **Cash Flow Analysis**: Built-in views for financial reporting

---

## 💰 How Money Circulates

### The Four Core Operations

1. **ADD FUNDS** (Deposit to Account)
   - Done via Capital & Accounts module
   - Increases account balance
   - Records transaction

2. **DISBURSE LOANS** (Money OUT)
   - **Must select source account**
   - Validates sufficient balance
   - Deducts from source account automatically
   - Records outflow transaction

3. **RECEIVE REPAYMENTS** (Money IN)
   - **Must select destination account**
   - Adds to destination account automatically
   - Records inflow transaction
   - Supports split payments to multiple accounts

4. **PAY EXPENSES** (Money OUT)
   - **Must select account to pay from**
   - Deducts from account when marked as "paid"
   - Records expense transaction

### Transfer Between Accounts
- Already exists in Capital & Accounts module
- Moves money from one account to another
- Both accounts update in real-time

---

## 📊 Dashboard Capital Pool Widget

### Location
**Admin Dashboard** → Top section (above "Needs Attention")

### Features
1. **Total Capital Pool**
   - Shows combined balance across all active accounts
   - Large, prominent display at the top
   - Toggle to show/hide sensitive balances (Eye icon)

2. **Account Type Breakdown**
   - **Bank Accounts** (Blue): Total in all bank accounts
   - **Mobile Money** (Green): Total in mobile money accounts
   - **Cash** (Yellow): Total in cash accounts

3. **Individual Account List**
   - Scrollable list of all active accounts
   - Shows account name, type, and current balance
   - Color-coded icons by account type
   - Real-time updates

4. **Visual Indicators**
   - Icons for each account type (Building, Smartphone, Banknote)
   - Color-coded backgrounds for easy identification
   - Hover effects for better UX

### Screenshot Reference
The widget matches your provided screenshot design:
- Large total at top with wallet icon
- Three-column breakdown (Bank, Mobile, Cash)
- List of individual accounts below
- "Available Balance" display style

---

## 🚀 Disbursement Flow (Money OUT)

### Before (Old System)
```
1. Select loan to disburse
2. Choose disbursement method
3. Enter account/phone number
4. Click "Disburse"
❌ No account tracking
❌ No balance validation
❌ Manual balance management
```

### After (New System)
```
1. Select loan to disburse
2. **SELECT SOURCE ACCOUNT** (NEW - REQUIRED)
   - Dropdown shows all active accounts
   - Displays current balance for each
   - Example: "Stanbic Bank (K500,000.00)"
3. Choose disbursement method (mobile money/bank)
4. Enter borrower's account/phone number
5. Click "Create Disbursement"
   
✅ Validates sufficient balance automatically
✅ Deducts from source account automatically
✅ Records transaction in account_transactions
✅ Shows error if insufficient funds
✅ Real-time balance update
```

### Example Error
```
❌ "Insufficient balance in Stanbic Bank. 
    Available: K300,000, Required: K500,000"
```

### Backend Process
1. Check if source account has sufficient balance
2. If yes:
   - Create disbursement record with `source_account_id`
   - Deduct amount from account balance
   - Insert transaction record
   - Update loan status to "disbursed"
3. If no:
   - Reject with clear error message

---

## 💵 Repayment Flow (Money IN)

### Before (Old System)
```
1. Select repayment to record
2. Enter amount received
3. Choose payment method
4. Enter transaction reference
5. Click "Record Payment"
❌ No account tracking
❌ Money goes "nowhere"
❌ Manual balance updates
```

### After (New System)
```
1. Select repayment to record
2. **SELECT DESTINATION ACCOUNT** (NEW - REQUIRED)
   - Dropdown shows all active accounts
   - Displays current balance for each
   - Example: "Mobile Money (K300,200.00)"
3. Enter amount received (supports partial payments)
4. Choose payment method
5. Enter transaction reference (optional)
6. Click "Confirm Payment"
   
✅ Adds payment to destination account automatically
✅ Records transaction in account_transactions
✅ Real-time balance update
✅ Supports split payments (multiple accounts)
```

### Split Payment Example
```
Customer pays K10,000:
- K6,000 via mobile money → Mobile Money Account
- K4,000 via cash → Cash Account

Both accounts update automatically
All splits recorded separately
```

### Backend Process
1. Validate destination account selected
2. Record repayment (full or partial)
3. Add payment amount to destination account
4. Insert transaction record
5. Send SMS confirmation to borrower
6. Invalidate all account queries (real-time update)

---

## 📝 Expense Flow (Money OUT)

### Current State
- Expenses already have `account_id` field ✅
- Form already has account selection dropdown ✅
- **NEW**: Now automatically deducts from account when marked as "paid"

### How It Works
```
1. Admin records expense
2. Selects account to pay from
3. Initially status = "pending"
4. When approved and marked as "paid":
   ✅ Amount deducted from selected account
   ✅ Transaction recorded
   ✅ Balance updates in real-time
```

### Example
```
Marketing Expense: K5,000
Paid from: Cash Account
Status: Paid

→ Cash Account balance: K50,000 → K45,000
→ Transaction recorded: "Expense: Marketing - Vendor Name"
```

---

## 🗄️ Database Schema

### New Fields

#### `disbursements` table
```sql
source_account_id UUID REFERENCES accounts(id)
```
- **Purpose**: Track which account funds came from
- **Required**: Yes (validation in application)
- **Indexed**: Yes (for performance)

#### `repayments` table
```sql
destination_account_id UUID REFERENCES accounts(id)
```
- **Purpose**: Track which account received the payment
- **Required**: Yes (validation in application)
- **Indexed**: Yes (for performance)

#### `expenses` table
```sql
account_id UUID REFERENCES accounts(id)
```
- **Purpose**: Track which account paid the expense
- **Note**: Already existed, now fully functional
- **Indexed**: Yes (for performance)

### New Database Objects

#### 1. `account_cash_flow` View
Shows comprehensive cash flow analysis:
```sql
SELECT * FROM account_cash_flow;
```

Returns:
- `account_id`: Account identifier
- `account_name`: Account name
- `account_type`: bank/mobile_money/cash
- `current_balance`: Current balance
- `total_repayments_received`: Total money IN (repayments)
- `total_disbursements_sent`: Total money OUT (disbursements)
- `total_expenses_paid`: Total money OUT (expenses)
- `net_cash_flow`: Net movement (IN - OUT)

#### 2. Validation Function
```sql
check_account_balance_before_disbursement()
```
- Runs automatically before every disbursement
- Checks if source account has sufficient funds
- Raises exception if insufficient balance

#### 3. Auto-Update Triggers
Three triggers automatically manage balances:

**a) Disbursement Trigger**
```sql
auto_update_account_disbursement
```
- Fires after INSERT or UPDATE on disbursements
- Deducts amount from source account
- Records transaction

**b) Repayment Trigger**
```sql
auto_update_account_repayment
```
- Fires after INSERT or UPDATE on repayments
- Adds amount to destination account
- Records transaction

**c) Expense Trigger**
```sql
auto_update_account_expense
```
- Fires after INSERT or UPDATE on expenses
- Deducts amount from account when status = "paid"
- Records transaction

---

## 🔄 Real-Time Updates

### Query Invalidation Strategy
Every mutation invalidates:
```typescript
queryClient.invalidateQueries({ queryKey: ["accounts"] });
queryClient.invalidateQueries({ queryKey: ["active-accounts"] });
```

This ensures:
- Dashboard capital pool updates immediately
- Account dropdowns show current balances
- No stale data anywhere in the system

### Toast Notifications
User sees confirmation:
- ✅ "Disbursement created and account balance updated"
- ✅ "Full payment recorded and deposited to account"
- ✅ "Partial payment of K5,000 recorded and deposited"

---

## 📋 User Flows

### Admin Disburses a Loan
1. Navigate to **Disbursements** module
2. Click "New Disbursement"
3. Select approved loan (e.g., "John Doe - K10,000")
4. **Select Source Account**: "Stanbic Bank (K500,000)"
5. Choose disbursement method: "Mobile Money"
6. Enter borrower's mobile money number
7. Enter amount (or leave blank for full amount)
8. Click "Create Disbursement"
9. System validates balance
10. Success! Money disbursed, balance updated

### Admin Records Repayment
1. Navigate to **Repayments** module
2. Find pending repayment
3. Click "Record Payment"
4. See amount due: K2,500
5. **Select Destination Account**: "Mobile Money (K300,200)"
6. Enter amount received (e.g., K2,500 for full or K1,000 for partial)
7. Select payment method: "Mobile Money"
8. Enter transaction reference (optional)
9. Click "Confirm Payment"
10. Success! Payment recorded, balance updated

### Admin Records Expense
1. Navigate to **Expenses** module
2. Click "Add Expense"
3. Fill expense details (category, vendor, amount)
4. **Select Account**: "Cash Account (K50,000)"
5. Submit expense (status = "pending")
6. Later, approve expense
7. Mark as "Paid"
8. Success! Amount deducted from Cash Account

---

## 🎨 UI Components

### Source Account Selector (Disbursements)
```tsx
<Select value={formData.source_account_id} ...>
  <SelectItem value={account.id}>
    <Building|Smartphone|Banknote size={14} />
    {account.account_name}
    (K{account.balance.toLocaleString()})
  </SelectItem>
</Select>
```

### Destination Account Selector (Repayments)
```tsx
<Select value={paymentData.destination_account_id} ...>
  <SelectItem value={account.id}>
    <Building|Smartphone|Banknote size={14} />
    {account.account_name}
    (K{account.balance.toLocaleString()})
  </SelectItem>
</Select>
```

### Capital Pool Widget
```tsx
<CapitalPoolWidget />
```
- Self-contained component
- Fetches accounts automatically
- Updates in real-time
- Responsive design

---

## 🔒 Validation & Error Handling

### Disbursement Validation
```typescript
if (!formData.source_account_id) {
  throw new Error("Please select a source account");
}

const sourceAccount = accounts.find(a => a.id === formData.source_account_id);
if (sourceAccount.balance < disbursementAmount) {
  throw new Error(
    `Insufficient balance in ${sourceAccount.account_name}. 
     Available: K${sourceAccount.balance.toLocaleString()}`
  );
}
```

### Repayment Validation
```typescript
if (!paymentData.destination_account_id) {
  toast.error("Please select a destination account");
  return;
}
```

### Database-Level Validation
```sql
-- Trigger prevents disbursement if balance insufficient
CREATE TRIGGER validate_disbursement_balance
  BEFORE INSERT ON disbursements
  FOR EACH ROW
  EXECUTE FUNCTION check_account_balance_before_disbursement();
```

---

## 📊 Reporting & Analytics

### Available Queries

#### 1. Total Capital Pool
```sql
SELECT SUM(balance) as total_pool
FROM accounts
WHERE is_active = true;
```

#### 2. Pool Breakdown by Type
```sql
SELECT 
  account_type,
  SUM(balance) as total,
  COUNT(*) as account_count
FROM accounts
WHERE is_active = true
GROUP BY account_type;
```

#### 3. Account Cash Flow
```sql
SELECT * FROM account_cash_flow
ORDER BY net_cash_flow DESC;
```

#### 4. Recent Transactions
```sql
SELECT 
  at.created_at,
  a.account_name,
  at.transaction_type,
  at.amount,
  at.balance_after,
  at.description
FROM account_transactions at
JOIN accounts a ON at.account_id = a.id
ORDER BY at.created_at DESC
LIMIT 50;
```

#### 5. Disbursements by Account
```sql
SELECT 
  a.account_name,
  COUNT(d.id) as disbursement_count,
  SUM(d.amount) as total_disbursed
FROM disbursements d
JOIN accounts a ON d.source_account_id = a.id
WHERE d.status = 'completed'
GROUP BY a.account_name;
```

#### 6. Repayments by Account
```sql
SELECT 
  a.account_name,
  COUNT(r.id) as repayment_count,
  SUM(r.amount) as total_received
FROM repayments r
JOIN accounts a ON r.destination_account_id = a.id
WHERE r.status = 'paid'
GROUP BY a.account_name;
```

---

## 🚨 Important Notes

### For Admins
1. **Always select an account** when disbursing or recording payments
2. **Check balances** before large disbursements (shown in dropdown)
3. **Use appropriate accounts** for different transaction types
   - Example: Mobile money repayments → Mobile Money Account
   - Example: Bank transfers → Bank Account
4. **Split payments** when receiving multiple payment methods
5. **Monitor capital pool** on dashboard daily

### For Developers
1. **Never bypass account selection** - it's required for audit trail
2. **All balance updates are automatic** - don't manually update balances
3. **Triggers handle everything** - trust the database triggers
4. **Invalidate queries** after mutations for real-time updates
5. **Test with small amounts** first to verify balance updates

### For Database Admins
1. **Run the migration** before using the system:
   ```bash
   supabase db push
   ```
2. **Existing data** without account_id will need backfilling
3. **Triggers are idempotent** - safe to re-run migration
4. **Monitor account_transactions** table growth (may need archiving)

---

## 🔄 Migration Path

### For Existing Installations

#### Step 1: Run Migration
```bash
cd /path/to/phinduloans
supabase db push
```

#### Step 2: Backfill Existing Data (Optional)
If you have existing disbursements/repayments without account references:
```sql
-- Create a default "Legacy" account
INSERT INTO accounts (account_name, account_type, balance, is_active)
VALUES ('Legacy Transactions', 'bank', 0, false);

-- Update existing disbursements
UPDATE disbursements
SET source_account_id = (SELECT id FROM accounts WHERE account_name = 'Legacy Transactions')
WHERE source_account_id IS NULL;

-- Update existing repayments
UPDATE repayments
SET destination_account_id = (SELECT id FROM accounts WHERE account_name = 'Legacy Transactions')
WHERE destination_account_id IS NULL AND status = 'paid';
```

#### Step 3: Test the System
1. Create a test account with K1,000 balance
2. Create a test loan application
3. Try disbursing using the test account
4. Verify balance decreased
5. Record a test repayment
6. Verify balance increased

#### Step 4: Train Staff
- Show them the new account dropdowns
- Explain the importance of selecting correct accounts
- Demonstrate the capital pool widget
- Walk through one complete cycle (disburse → repay)

---

## ✅ Benefits of This System

### Financial Control
- ✅ Know exactly where every ZMW is
- ✅ Prevent accidental overdrafts
- ✅ Track money flow between accounts
- ✅ Instant visibility into available capital

### Audit & Compliance
- ✅ Complete transaction history
- ✅ Account-level reconciliation
- ✅ Clear audit trail for regulators
- ✅ Automated record-keeping

### Operational Efficiency
- ✅ No manual balance tracking
- ✅ Real-time updates everywhere
- ✅ Automated transaction recording
- ✅ Error prevention with validation

### Reporting & Analytics
- ✅ Cash flow analysis by account
- ✅ Account performance tracking
- ✅ Financial health monitoring
- ✅ Easy reconciliation

---

## 🎯 Summary

The Phindu Loans system now operates as a **true account-based financial platform**:

1. ✅ **Every transaction** requires account selection
2. ✅ **All balances** update automatically and in real-time
3. ✅ **Complete audit trail** via account_transactions table
4. ✅ **Dashboard visibility** with Capital Pool Widget
5. ✅ **Validation** prevents overdrafts
6. ✅ **Zero manual** balance management needed

**The system ensures**: *You can only spend what you have, and every ZMW is accounted for.*

---

## 📞 Support

For questions or issues:
1. Check the dashboard Capital Pool Widget for current balances
2. Review account_transactions table for transaction history
3. Use account_cash_flow view for analysis
4. Contact system administrator for account setup

---

*Implementation completed: January 8, 2026*  
*Version: 2.0 - Account-Based Financial Management*
