# Supabase Email Configuration Guide

## Problem
Emails with verification codes (OTP) are not being sent when users sign up.

## Solution: Configure Supabase Email Templates

### Step 1: Enable Email OTP in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project: `chrdcugzkuidvcfydsub`
3. Navigate to **Authentication** → **Providers**
4. Scroll down and find **Email**
5. Make sure these settings are configured:
   - ✅ **Enable email provider** = ON
   - ✅ **Confirm email** = ON
   - ✅ **Secure email change** = ON (optional)

### Step 2: Configure Email Template for OTP

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. Select **"Confirm signup"** template
3. **IMPORTANT**: Update the template to include the OTP token

**Recommended Template:**

```html
<h2>Confirm your signup</h2>

<p>Hello,</p>

<p>Thank you for signing up! Please use the verification code below to confirm your email:</p>

<h1 style="font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 8px; letter-spacing: 5px;">
  {{ .Token }}
</h1>

<p>This code will expire in 24 hours.</p>

<p>If you didn't sign up for this account, you can safely ignore this email.</p>

<p>Thanks,<br>
The Team</p>
```

**Key Points:**
- The `{{ .Token }}` variable contains the 6-digit OTP code
- This must be included in the email template
- Save the template after editing

### Step 3: Configure Email Provider (if needed)

#### Option A: Use Supabase's Built-in Email Service (Development)
- Works out of the box
- Has rate limits (good for testing)
- No additional configuration needed

#### Option B: Use Custom SMTP (Production)
1. Go to **Project Settings** → **Auth**
2. Scroll to "SMTP Settings"
3. Configure your email provider:
   - **Host**: smtp.your-provider.com
   - **Port**: 587 (or 465)
   - **Username**: your-email@domain.com
   - **Password**: your-smtp-password
   - **Sender email**: noreply@yourdomain.com
   - **Sender name**: Your App Name

Popular SMTP providers:
- SendGrid
- Mailgun
- AWS SES
- Postmark
- Resend

### Step 4: Test Email Sending

1. Try signing up a new user
2. Check if email arrives with 6-digit code
3. Check Supabase logs: **Logs** → **Auth Logs** for any errors

### Step 5: Check Email in Spam/Junk

Sometimes test emails go to spam. Check:
- Spam/Junk folder
- Promotions tab (Gmail)
- Wait a few minutes (can be delayed)

## Troubleshooting

### Emails Not Arriving

**Check 1: Email Provider Configured?**
- Go to Auth logs and look for email sending errors
- If using custom SMTP, verify credentials

**Check 2: Email Confirmation Enabled?**
- Authentication → Providers → Email → "Confirm email" should be ON

**Check 3: Template Has Token?**
- Email Templates → Confirm signup → Should contain `{{ .Token }}`

**Check 4: Rate Limits?**
- Supabase free tier has email rate limits
- Check if you hit the limit in dashboard

### Code is Correct in App

Your application code is already set up correctly:
- ✅ `supabase.auth.signUp()` - Sends confirmation email
- ✅ `supabase.auth.resend()` - Resends code
- ✅ `supabase.auth.verifyOtp()` - Verifies the code

The issue is **Supabase configuration**, not your code.

## Quick Test (Development Only)

If you just want to test without email, you can:
1. Go to Authentication → Providers → Email
2. **Disable** "Confirm email"
3. Users will be auto-confirmed on signup
4. Re-enable for production

## Production Checklist

Before going live:
- [ ] Custom SMTP configured
- [ ] Email template includes `{{ .Token }}`
- [ ] "Confirm email" is ENABLED
- [ ] Sender email is verified
- [ ] Test with real email addresses
- [ ] Check spam folder behavior
