# Campay Payment Configuration

## Environment Variables

All Campay settings can be configured via environment variables. Create a `.env.local` file in your project root with the following variables:

### Required Variables

```bash
# Campay Environment
# Options: 'demo' (for testing) or 'live' (for production)
VITE_CAMPAY_ENVIRONMENT=demo

# Campay App ID
# This is the main identifier for your Campay account
# Get this from your Campay dashboard
VITE_CAMPAY_APP_ID=your_campay_app_id_here
```

### Optional Variables

```bash
# Demo Amount (only used when environment is 'demo')
# Amount in FCFA for testing transactions
VITE_CAMPAY_DEMO_AMOUNT=10

# Redirect URL after payment completion
# Leave empty for no redirect
VITE_CAMPAY_REDIRECT_URL=
```

## Configuration Examples

### Demo/Testing Configuration
```bash
VITE_CAMPAY_ENVIRONMENT=demo
VITE_CAMPAY_APP_ID=Muw-QotZAcx8PbngvT7lbsnc1OomeDkw31sWjv5XftEBoSy_opiLcFz17UhClFC6ZNm8AOdL6xFCH7KoUEUN5Q
VITE_CAMPAY_DEMO_AMOUNT=10
VITE_CAMPAY_REDIRECT_URL=
```

### Production Configuration
```bash
VITE_CAMPAY_ENVIRONMENT=live
VITE_CAMPAY_APP_ID=your_live_campay_app_id
VITE_CAMPAY_REDIRECT_URL=https://yourdomain.com/payment-success
```

## How It Works

1. **Environment Detection**: The system always uses the live Campay endpoint:
   - Both Demo and Live: `https://www.campay.net/sdk/js`

2. **App ID**: The `app-id` parameter in the script URL identifies your specific Campay account (use your live App ID for both modes)

3. **Demo Mode**: When in demo mode, the Campay modal shows actual prices but charges only the demo amount (10 FCFA). Firebase still stores the correct actual amounts for proper record keeping.

4. **Account Switching**: To switch between different Campay accounts, simply change the `VITE_CAMPAY_APP_ID` value

## Getting Your Campay App ID

1. Log in to your Campay dashboard
2. Go to your account settings or API settings
3. Copy your App ID
4. Set it as the `VITE_CAMPAY_APP_ID` environment variable

## Security Notes

- Never commit your `.env.local` file to version control
- Use different App IDs for development and production
- The demo App ID is safe to use for testing but should not be used in production
