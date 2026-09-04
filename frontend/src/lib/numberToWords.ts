// Converts a rupee amount to words using the Indian numbering system
// (lakh/crore groupings), matching how Indian tax invoices conventionally
// spell out "Amount Chargeable (in words)" and "Tax Amount (in words)".
// Paise are rounded to the nearest rupee — invoices here don't carry
// fractional-rupee line items, and GST-invoice word lines are always
// whole-rupee in practice.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens];
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/** e.g. 7500 -> "Seven Thousand Five Hundred", 150000 -> "One Lakh Fifty Thousand" */
export function numberToIndianWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (remainder) parts.push(threeDigitsToWords(remainder));

  return parts.join(" ");
}

/** e.g. 7500 -> "INR Seven Thousand Five Hundred Only" */
export function amountInWords(amount: number, currency: string = "INR"): string {
  return `${currency} ${numberToIndianWords(amount)} Only`;
}
