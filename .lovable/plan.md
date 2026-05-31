## Plan

Fix the loan creation borrower picker so newly added borrowers are easy to select again.

### What I will change
1. **Use product-house borrowers for loan creation**
   - Change `ProductLoanFormShell` to fetch borrowers through the existing `fetchHouseBorrowers(productCode)` repository method instead of loading only the latest 300 global profiles.
   - This matches the Borrowers tab and ensures borrowers added to that house appear in that house’s loan form.

2. **Keep newest borrowers at the top**
   - Preserve the `product_house_borrowers.created_at DESC` ordering so the latest added borrower appears first, as before.

3. **Add search instead of endless scrolling**
   - Replace the plain dropdown list with a searchable borrower picker by name, NRC, phone, or email.
   - Show a clear empty state when no borrower matches.

4. **Refresh related cached data after borrower creation**
   - Ensure adding a borrower invalidates both the house borrower list and the loan form borrower list so the borrower appears immediately without reload.

### Technical details
- Main file: `src/components/admin/ProductLoanFormShell.tsx`
- Supporting cache invalidation: `src/pages/admin/houses/HouseBorrowersPage.tsx` and possibly `src/pages/admin/AdminBorrowers.tsx`
- No database rule changes are needed; this is a frontend query/picker issue.