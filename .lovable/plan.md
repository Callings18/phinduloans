## What is going on

Payday Soft is configured as a 30-day product, but the schedule generator treats any `term_unit = days` loan as a daily-installment loan. Because Payday Soft has `term_unit = days` and `loan_term_months = 30`, it generated 30 small repayment rows from disbursement/start date onward. Those early rows are now before today, so the app marks them overdue.

This is not the Payday Soft rule you specified. Payday Soft should be one single bullet payment due exactly 30 days after disbursement, not daily collections.

## Plan

1. **Fix the frontend schedule generator**
   - In `createRepaymentScheduleForLoan`, detect `repayment_frequency = bullet` / `PAYDAY_SOFT` before daily logic.
   - Generate exactly 1 repayment row for Payday Soft.
   - Due date = disbursement date + 30 days, unless an explicit repayment start date is provided.
   - Amount = full `total_repayment`.

2. **Fix the database schedule function**
   - Update `public.generate_loan_schedule_for` so bullet loans generate one repayment row.
   - This prevents backend triggers from creating daily Payday rows during disbursement.
   - Keep Marketeer daily behavior unchanged.

3. **Repair existing bad Payday schedules**
   - For active Payday Soft loans with unpaid daily rows, cancel/rebuild those unpaid rows into a single bullet repayment.
   - Preserve any paid/partial history instead of deleting it.
   - For the current bad active loans with no payments recorded, this will remove the false overdue daily rows and leave one future due date.

4. **Fix UI labels that infer “daily” from `term_unit = days`**
   - Update shared labels so `repayment_frequency = bullet` displays as “Single payment” / “BULLET PAYMENT”, not daily installment.
   - Update Payday house loan detail/schedule display so it does not show daily wording.

5. **Regression coverage**
   - Add/update tests for Payday Soft: 30 days, 30% flat, one bullet installment due on day 30.
   - Keep existing Marketeer daily tests passing conceptually: Marketeer remains daily, Payday Soft is not daily.

## Files / backend areas involved

- `src/utils/createRepaymentSchedule.ts`
- `src/utils/repaymentFrequencyLabels.ts`
- Payday-related tests in `src/utils/__tests__`
- Lovable Cloud migration for `generate_loan_schedule_for` and data repair of existing Payday repayment rows