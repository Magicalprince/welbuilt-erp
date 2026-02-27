# PDF Redesign: Attendance & Payslip Services

## Problems

### Attendance PDF
1. Logo clipped - aspect ratio makes it taller than allocated space
2. Details box - fixed 100px height causes overflow/whitespace mismatches
3. Stat cards - solid colored rectangles with white text look flat
4. Footer gap - large gap between stats and footer

### Payslip PDF
1. Monthly stipend shows ₹0 - intern.stipend often unset, no input in modal
2. Monthly payment logic wrong - MONTHLY type shows only 1 month's stipend as total
3. No monthly breakdown - missing per-month line items
4. Basic table - single Description/Amount columns, no visual hierarchy

### Form (PayslipTab.tsx)
5. No monthly stipend input - when intern.stipend is 0, no way to enter it

## Design

### Shared Header (both PDFs)
- Logo: constrained to max 40px height (prevents clipping)
- Company name right-aligned with address block
- Blue accent divider line below

### Attendance PDF
- Title: Blue banner (keep current)
- Details: Auto-height bordered section, 2-column grid, 15px row spacing
- Stat cards: White background with colored left accent bar (4px), large bold colored number, gray label. Light border.
- Footer: Tighter spacing, seal+signature properly positioned

### Payslip PDF - Monthly Payment Fix
- MONTHLY type table rows:
  - "Monthly Stipend" → ₹X
  - "Number of Months" → N
  - "Subtotal (₹X × N months)" → ₹Total
- ONE_TIME type table rows:
  - "Monthly Stipend" → ₹X
  - "Number of Months" → N
  - "Total Stipend" → ₹(X×N)
- Both types: Net = monthlyStipend × numberOfMonths
- Table: Alternating row backgrounds, bold header, thicker total borders
- Net Amount: Green bordered box with amount in words

### Form Fix (PayslipTab.tsx)
- Add "Monthly Stipend Amount" input in GeneratePayslipModal
- Pre-fill from intern.stipend if available
- Live-calculate total as stipend/months change

## Files Changed
1. `src/services/attendanceService.ts` - Redesign PDF layout
2. `src/services/payslipService.ts` - Fix monthly logic + redesign PDF layout
3. `src/pages/interns/PayslipTab.tsx` - Add monthlyStipend input field
