# Apple Sign In Configuration Test

## Your Configuration

**Team ID**: `HV3JCSJT9Z`
**Key ID**: `ZNVJQCLCS3`
**Bundle ID**: `com.seaband.guildtasks`
**Service ID**: `???` (Please verify what you entered in Supabase)

## Apple Developer Console Checklist

### Service ID Configuration
Go to: https://developer.apple.com/account/resources/identifiers/list/serviceId

- [ ] Service ID exists (e.g., `com.seaband.guildtasks.web`)
- [ ] "Sign in with Apple" is enabled
- [ ] Primary App ID is set to: `com.seaband.guildtasks`
- [ ] Return URL is EXACTLY: `https://acdpgnkrpeskdpztvrvz.supabase.co/auth/v1/callback`
- [ ] Domain is: `acdpgnkrpeskdpztvrvz.supabase.co`

### Key Configuration
Go to: https://developer.apple.com/account/resources/authkeys/list

- [ ] Key "gtsignin" exists with ID `ZNVJQCLCS3`
- [ ] Key has "Sign in with Apple" enabled
- [ ] Downloaded the .p8 file

## Supabase Configuration Checklist

Go to: https://supabase.com/dashboard/project/acdpgnkrpeskdpztvrvz/auth/providers

### Apple Provider Settings
- [ ] Apple provider is enabled (toggled on)
- [ ] **Services ID**: Enter your Service ID (e.g., `com.seaband.guildtasks.web`)
  - ⚠️ This should be the SERVICE ID, not the Bundle ID!
- [ ] **Team ID**: `HV3JCSJT9Z`
- [ ] **Key ID**: `ZNVJQCLCS3`
- [ ] **Private Key**: Full contents of AuthKey_ZNVJQCLCS3.p8 file
  ```
  -----BEGIN PRIVATE KEY-----
  (Your key here)
  -----END PRIVATE KEY-----
  ```

### URL Configuration
Go to: https://supabase.com/dashboard/project/acdpgnkrpeskdpztvrvz/auth/url-configuration

- [ ] Site URL is set (can be `http://localhost:3000` for testing)
- [ ] Redirect URLs include:
  - `http://localhost:3000/**`
  - `https://guildtasks.com/**`

## Common Errors

### "Unable to exchange external code"
This means Apple successfully authenticated but Supabase can't verify the response. Causes:
1. **Service ID mismatch**: Service ID in Supabase doesn't match Apple
2. **Wrong private key**: Key is truncated, has extra spaces, or wrong key
3. **Return URL mismatch**: Return URL in Apple doesn't match Supabase callback
4. **Propagation delay**: Apple changes can take 10-15 minutes

## Debugging Steps

1. **Verify Service ID**:
   - In Apple: Note the exact Service ID identifier
   - In Supabase: Make sure it matches EXACTLY

2. **Verify Private Key**:
   - Open AuthKey_ZNVJQCLCS3.p8 in a text editor
   - Copy ALL contents (including BEGIN/END lines)
   - Paste into Supabase with no modifications

3. **Wait for propagation**:
   - After saving in Apple, wait 10-15 minutes
   - Clear browser cache or use incognito

4. **Check Supabase logs**:
   - Go to: https://supabase.com/dashboard/project/acdpgnkrpeskdpztvrvz/logs/explorer
   - Look for detailed error messages

## Test Again

After verifying all checkboxes above:
1. Wait 10-15 minutes if you just made changes
2. Clear browser cache or use incognito window
3. Go to http://localhost:3000/signup
4. Click "Continue with Apple"
5. Check server logs for any new errors
