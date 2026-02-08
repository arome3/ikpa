/**
 * Email Templates for Import Notifications
 *
 * Styled HTML/text templates for:
 * - Expense confirmation emails (after auto-import)
 * - Import welcome/onboarding emails
 * - Weekly digest emails
 *
 * Follows the existing IKPA email template pattern:
 * gradient header, inline CSS, CTA buttons.
 */

// ================================================
// Expense Confirmation Email
// ================================================

export interface ExpenseConfirmationData {
  userName: string;
  amount: number;
  currency: string;
  merchant: string | null;
  categoryName: string;
  date: Date;
  description: string | null;
  budgetPercent: number | null;
  budgetTotal: number | null;
  budgetSpent: number | null;
  isOverBudget: boolean;
  frontendUrl: string;
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = { NGN: '\u20A6', USD: '$', GHS: 'GH\u20B5' };
  const symbol = symbols[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getBudgetColor(percent: number): string {
  if (percent >= 100) return '#ef4444';
  if (percent >= 80) return '#f59e0b';
  return '#10b981';
}

function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => entities[c] || c);
}

export function buildExpenseConfirmationEmail(data: ExpenseConfirmationData): {
  html: string;
  text: string;
  subject: string;
} {
  const merchantDisplay = data.merchant ? escapeHtml(data.merchant) : 'Unknown Merchant';
  const amountStr = formatCurrency(data.amount, data.currency);
  const dateStr = formatDate(data.date);
  const year = new Date().getFullYear();

  const budgetSection = data.budgetPercent !== null && data.budgetTotal !== null && data.budgetSpent !== null
    ? buildBudgetProgressHtml(data)
    : '';

  const budgetTextSection = data.budgetPercent !== null && data.budgetTotal !== null && data.budgetSpent !== null
    ? buildBudgetProgressText(data)
    : '';

  const recoveryHint = data.isOverBudget
    ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
        <strong style="color: #991b1b;">Over budget</strong>
        <p style="margin: 4px 0 0 0; color: #7f1d1d; font-size: 14px;">Open the GPS Re-Router in your dashboard to get a personalized recovery plan.</p>
      </div>`
    : '';

  const recoveryTextHint = data.isOverBudget
    ? '\n!! Over budget - Open GPS Re-Router in your dashboard for a recovery plan.\n'
    : '';

  const subject = `Expense recorded: ${amountStr} at ${data.merchant || 'merchant'}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Confirmed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Expense Recorded</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">From your forwarded bank alert</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Hi ${escapeHtml(data.userName)},</p>

    <p>We received your bank alert and automatically recorded this expense:</p>

    <!-- Receipt Card -->
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;">Amount</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 20px; color: #1a1a1a;">${amountStr}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e0e0e0;">Merchant</td>
          <td style="padding: 8px 0; text-align: right; color: #333; border-top: 1px solid #e0e0e0;">${merchantDisplay}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e0e0e0;">Category</td>
          <td style="padding: 8px 0; text-align: right; color: #333; border-top: 1px solid #e0e0e0;">${escapeHtml(data.categoryName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e0e0e0;">Date</td>
          <td style="padding: 8px 0; text-align: right; color: #333; border-top: 1px solid #e0e0e0;">${dateStr}</td>
        </tr>
        ${data.description ? `<tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e0e0e0;">Description</td>
          <td style="padding: 8px 0; text-align: right; color: #333; border-top: 1px solid #e0e0e0; font-size: 13px;">${escapeHtml(data.description)}</td>
        </tr>` : ''}
      </table>
    </div>

    ${budgetSection}
    ${recoveryHint}

    <!-- CTAs -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 0 6px;">
        View in App
      </a>
    </div>

    <p style="color: #999; font-size: 12px; text-align: center;">
      This expense was auto-imported from your forwarded bank alert. If this doesn't look right, open the app to edit or delete it.
    </p>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    &copy; ${year} IKPA. All rights reserved.
  </p>
</body>
</html>`;

  const text = `IKPA - Expense Recorded

Hi ${data.userName},

We received your bank alert and automatically recorded this expense:

Amount: ${amountStr}
Merchant: ${data.merchant || 'Unknown'}
Category: ${data.categoryName}
Date: ${dateStr}
${data.description ? `Description: ${data.description}\n` : ''}
${budgetTextSection}${recoveryTextHint}
View in app: ${data.frontendUrl}/dashboard

This expense was auto-imported from your forwarded bank alert. If this doesn't look right, open the app to edit or delete it.

---
(c) ${year} IKPA. All rights reserved.`.trim();

  return { html, text, subject };
}

function buildBudgetProgressHtml(data: ExpenseConfirmationData): string {
  const percent = Math.min(data.budgetPercent!, 100);
  const color = getBudgetColor(data.budgetPercent!);
  const spentStr = formatCurrency(data.budgetSpent!, data.currency);
  const totalStr = formatCurrency(data.budgetTotal!, data.currency);

  return `
    <div style="margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px; color: #333;">
        ${escapeHtml(data.categoryName)} Budget
      </p>
      <div style="background: #e5e7eb; border-radius: 9999px; height: 12px; overflow: hidden;">
        <div style="background: ${color}; height: 100%; width: ${percent}%; border-radius: 9999px; transition: width 0.3s;"></div>
      </div>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #666;">
        ${spentStr} of ${totalStr} (${Math.round(data.budgetPercent!)}%)
      </p>
    </div>`;
}

function buildBudgetProgressText(data: ExpenseConfirmationData): string {
  const spentStr = formatCurrency(data.budgetSpent!, data.currency);
  const totalStr = formatCurrency(data.budgetTotal!, data.currency);
  return `${data.categoryName} Budget: ${spentStr} of ${totalStr} (${Math.round(data.budgetPercent!)}%)\n`;
}

// ================================================
// Import Welcome Email
// ================================================

export interface ImportWelcomeData {
  userName: string;
  emailAddress: string;
  frontendUrl: string;
}

export function buildImportWelcomeEmail(data: ImportWelcomeData): {
  html: string;
  text: string;
  subject: string;
} {
  const year = new Date().getFullYear();
  const subject = 'Your IKPA import email is ready';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Import Email Ready</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Email Import Ready</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Forward bank alerts, we'll do the rest</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Hi ${escapeHtml(data.userName)},</p>

    <p>Your personal import email address is ready:</p>

    <div style="background: #f0f4ff; border: 2px dashed #667eea; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
      <code style="font-size: 16px; color: #4338ca; font-weight: 600;">${escapeHtml(data.emailAddress)}</code>
    </div>

    <h3 style="color: #333; margin-top: 24px;">How it works</h3>
    <ol style="padding-left: 20px; color: #555;">
      <li>Forward bank alert emails to the address above</li>
      <li>IKPA parses the transaction automatically</li>
      <li>Your expense is created and categorized</li>
      <li>You get a confirmation email with budget impact</li>
    </ol>

    <h3 style="color: #333;">Set up auto-forwarding</h3>
    <p style="font-size: 14px; color: #555;">For hands-free tracking, set up auto-forwarding in your email client:</p>
    <ul style="padding-left: 20px; color: #555; font-size: 14px;">
      <li><strong>Gmail:</strong> Settings &rarr; Forwarding &rarr; Add a forwarding address</li>
      <li><strong>Outlook:</strong> Settings &rarr; Mail &rarr; Forwarding &rarr; Enable forwarding</li>
      <li><strong>Yahoo:</strong> Settings &rarr; More Settings &rarr; Mailboxes &rarr; Forward</li>
    </ul>

    <h3 style="color: #333;">Supported banks</h3>
    <p style="font-size: 14px; color: #555;">
      <strong>Nigeria:</strong> GTBank, Access Bank, First Bank, Zenith, UBA, Kuda, Opay, Moniepoint<br>
      <strong>US:</strong> Chase, Bank of America, Wells Fargo, Capital One, Citi, Amex, Discover, US Bank, PNC
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.frontendUrl}/dashboard/import" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
        Go to Import Dashboard
      </a>
    </div>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    &copy; ${year} IKPA. All rights reserved.
  </p>
</body>
</html>`;

  const text = `IKPA - Your Import Email is Ready

Hi ${data.userName},

Your personal import email address is ready:

${data.emailAddress}

How it works:
1. Forward bank alert emails to the address above
2. IKPA parses the transaction automatically
3. Your expense is created and categorized
4. You get a confirmation email with budget impact

Set up auto-forwarding:
- Gmail: Settings > Forwarding > Add a forwarding address
- Outlook: Settings > Mail > Forwarding > Enable forwarding
- Yahoo: Settings > More Settings > Mailboxes > Forward

Supported banks:
Nigeria: GTBank, Access Bank, First Bank, Zenith, UBA, Kuda, Opay, Moniepoint
US: Chase, Bank of America, Wells Fargo, Capital One, Citi, Amex, Discover, US Bank, PNC

Go to Import Dashboard: ${data.frontendUrl}/dashboard/import

---
(c) ${year} IKPA. All rights reserved.`.trim();

  return { html, text, subject };
}

// ================================================
// Weekly Digest Email
// ================================================

export interface WeeklyDigestData {
  userName: string;
  totalImported: number;
  totalAmount: number;
  currency: string;
  categories: Array<{
    name: string;
    amount: number;
    count: number;
    budgetPercent: number | null;
  }>;
  frontendUrl: string;
  periodStart: Date;
  periodEnd: Date;
}

export function buildWeeklyDigestEmail(data: WeeklyDigestData): {
  html: string;
  text: string;
  subject: string;
} {
  const year = new Date().getFullYear();
  const totalStr = formatCurrency(data.totalAmount, data.currency);
  const periodStr = `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`;
  const subject = `Weekly import digest: ${data.totalImported} expenses (${totalStr})`;

  const categoryRowsHtml = data.categories
    .map((cat) => {
      const catAmount = formatCurrency(cat.amount, data.currency);
      const budgetBar = cat.budgetPercent !== null
        ? `<div style="background: #e5e7eb; border-radius: 9999px; height: 8px; margin-top: 4px; overflow: hidden;">
            <div style="background: ${getBudgetColor(cat.budgetPercent)}; height: 100%; width: ${Math.min(cat.budgetPercent, 100)}%; border-radius: 9999px;"></div>
          </div>
          <span style="font-size: 11px; color: #888;">${Math.round(cat.budgetPercent)}% of budget</span>`
        : '';
      return `<tr>
        <td style="padding: 10px 0; border-top: 1px solid #eee;">
          <strong>${escapeHtml(cat.name)}</strong><br>
          <span style="font-size: 13px; color: #888;">${cat.count} expense${cat.count !== 1 ? 's' : ''}</span>
          ${budgetBar}
        </td>
        <td style="padding: 10px 0; text-align: right; border-top: 1px solid #eee; font-weight: 600;">${catAmount}</td>
      </tr>`;
    })
    .join('');

  const categoryRowsText = data.categories
    .map((cat) => {
      const catAmount = formatCurrency(cat.amount, data.currency);
      const budgetInfo = cat.budgetPercent !== null ? ` (${Math.round(cat.budgetPercent)}% of budget)` : '';
      return `- ${cat.name}: ${catAmount} (${cat.count} expense${cat.count !== 1 ? 's' : ''})${budgetInfo}`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Import Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Weekly Import Digest</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${periodStr}</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p>Hi ${escapeHtml(data.userName)},</p>

    <p>Here's your weekly summary of email-imported expenses:</p>

    <!-- Summary Card -->
    <div style="background: #f0f4ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
      <div style="font-size: 32px; font-weight: 700; color: #4338ca;">${totalStr}</div>
      <div style="font-size: 14px; color: #666; margin-top: 4px;">${data.totalImported} expense${data.totalImported !== 1 ? 's' : ''} imported via email</div>
    </div>

    <!-- Category Breakdown -->
    <h3 style="color: #333; margin-top: 24px;">By Category</h3>
    <table style="width: 100%; border-collapse: collapse;">
      ${categoryRowsHtml}
    </table>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
        View Dashboard
      </a>
    </div>
  </div>

  <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
    &copy; ${year} IKPA. All rights reserved.
  </p>
</body>
</html>`;

  const text = `IKPA - Weekly Import Digest
${periodStr}

Hi ${data.userName},

Weekly summary of email-imported expenses:

Total: ${totalStr} (${data.totalImported} expenses)

By Category:
${categoryRowsText}

View dashboard: ${data.frontendUrl}/dashboard

---
(c) ${year} IKPA. All rights reserved.`.trim();

  return { html, text, subject };
}
