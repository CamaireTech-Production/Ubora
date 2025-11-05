# Gmail App Password Setup Guide

## Quick Setup Steps

### Step 1: Enable 2-Step Verification (Required)

1. Go to your Google Account security page:
   ```
   https://myaccount.google.com/security
   ```

2. Look for "2-Step Verification" in the list
   - If it says "On" → ✅ You're good, skip to Step 2
   - If it says "Off" → Click it and follow the setup process

3. Enable 2-Step Verification:
   - Google will guide you through phone verification
   - This is required to generate App Passwords

### Step 2: Generate App Password

1. Go to the App Passwords page:
   ```
   https://myaccount.google.com/apppasswords
   ```

2. If you don't see App Passwords option:
   - Make sure 2-Step Verification is enabled (Step 1)
   - Sometimes Google hides it; try: https://myaccount.google.com/apppasswords directly

3. In the App Passwords page:
   - **Select app**: Choose "Mail"
   - **Select device**: Choose "Other (Custom name)"
   - **Enter name**: Type "Ubora SMTP" (or any name you like)
   - Click **"Generate"**

4. Google will show you a 16-character password:
   ```
   Example: abcd efgh ijkl mnop
   ```
   - **Copy this password immediately** (you won't see it again!)
   - You can copy it with or without spaces - both work

### Step 3: Update Your .env.local File

1. Open `.env.local` in your project root

2. Update the email configuration:
   ```bash
   EMAIL_USER=uboraarcha@gmail.com
   EMAIL_PASSWORD=abcdefghijklmnop
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_FROM=uboraarcha@gmail.com
   EMAIL_FROM_NAME=Ubora App
   ```

3. Replace `abcdefghijklmnop` with your actual App Password from Step 2

4. Save the file

### Step 4: Test the Configuration

Run the test script:
```bash
node scripts/test-email.js
```

You should see:
```
📧 [Email Test] ✅ SMTP connection verified
📧 [Email Test] ✅ Test email sent successfully!
```

## Troubleshooting

### Can't find App Passwords option?
- Make sure 2-Step Verification is enabled first
- Try accessing directly: https://myaccount.google.com/apppasswords
- Use a desktop browser (not mobile)

### Still getting "Invalid login" error?
1. Double-check you copied the App Password correctly
2. Make sure there are no extra spaces in `.env.local`
3. Try removing spaces from the password: `abcdefghijklmnop` instead of `abcd efgh ijkl mnop`
4. Restart your server after updating `.env.local`

### App Password doesn't work?
- Delete the old App Password and generate a new one
- Make sure `.env.local` is in the project root (not in `api/` folder)
- Check that your server is loading `.env.local` correctly

## Security Notes

✅ **App Passwords are safe:**
- They only work for SMTP (email sending)
- They cannot access your Google Account
- They cannot read your emails
- You can revoke them anytime from Google Account settings

✅ **Best practices:**
- Never commit `.env.local` to git (it's already in `.gitignore`)
- Don't share your App Password
- Revoke old App Passwords if you stop using them

## Need Help?

If you're stuck, check:
1. Is 2-Step Verification enabled? ✅
2. Did you generate an App Password? ✅
3. Did you copy it correctly? ✅
4. Did you update `.env.local`? ✅
5. Did you restart your server? ✅

Run `node scripts/test-email.js` again after each step!

