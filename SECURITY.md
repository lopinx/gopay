# Security Notice

## ⚠️ Git History Rewrite Completed

**Date**: 2026-03-21  
**Action**: Git history has been rewritten to remove sensitive information

### What Changed

1. **MIT License Added** (`LICENSE`)
2. **Sensitive Data Removed** from `config.js`:
   - Merchant keys replaced with `YOUR_MERCHANT_KEY_HERE`
   - Alipay AppID replaced with `YOUR_ALIPAY_APPID_HERE`
   - Alipay private key replaced with `YOUR_ALIPAY_PRIVATE_KEY_HERE`
   - Alipay public key replaced with `YOUR_ALIPAY_PUBLIC_KEY_HERE`

3. **Git History Rewritten**:
   - All historical commits containing sensitive data have been modified
   - All commit hashes have changed
   - Reflog has been purged

### ⚠️ Important Notice for Collaborators

**If you have cloned this repository before 2026-03-21**:

1. **Delete your local clone** and re-clone from the remote

   ```bash
   rm -rf /path/to/gopay
   git clone https://github.com/lopinx/gopay.git
   ```

2. **Do NOT pull or merge** - this will create conflicts due to rewritten history

3. **Fork owners**: You must delete and re-fork the repository

### For Repository Admins

**Actions Required**:

1. ✅ **Regenerate ALL exposed credentials**:
   - Alipay AppID and keys
   - Merchant keys
   - Database passwords
   - Any API tokens

2. ✅ **Rotate secrets** in production environments

3. ✅ **Update CI/CD** pipelines with new secrets

4. ✅ **Notify all team members** to re-clone the repository

5. ✅ **Check GitHub/GitLab security alerts** for any exposed tokens

### Security Improvements Implemented

- ✅ Prototype pollution protection
- ✅ Timing attack prevention (crypto.timingSafeEqual)
- ✅ Race condition fixes (atomic order updates)
- ✅ Graceful shutdown handling
- ✅ Rate limiting
- ✅ XSS protection
- ✅ SSRF protection
- ✅ Database indexes
- ✅ Comprehensive E2E tests

### Contact

If you discover any security issues, please report them to the repository maintainers.
