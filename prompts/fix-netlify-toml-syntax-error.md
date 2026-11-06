# Implementation Blueprint: Fix Netlify.toml Configuration Parsing Error

## Objective
Fix the Netlify deployment failure during configuration parsing:
```
Failed during stage 'Reading and parsing configuration files': 
When resolving config file /opt/build/repo/netlify.toml:
Configuration property "functions.timeout" is not allowed
Failing build: Failed to parse configuration
```

---

## 1. Root Cause
In commit `ce77c62`, the following block was added to [`netlify.toml`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/netlify.toml#L20-L21):
```toml
[functions]
  timeout = 26
```
Netlify's buildbot configuration schema does not permit arbitrary `timeout` keys under `[functions]` in `netlify.toml` (Netlify function timeouts are managed via Netlify account plan settings / Netlify UI, not via the TOML config file). When Netlify's configuration parser encounters `[functions] timeout = 26`, it fails with:
`\u001b[36mConfiguration property "functions.timeout" is not allowed` (surfaced as `Co` in the buildbot summary).

---

## 2. Proposed Fix
Revert lines 20-21 of [`netlify.toml`](file:///c:/Users/acer/Desktop/-vicalary-app-for-vic.-main/netlify.toml) back to the clean, valid configuration that previously built successfully:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NETLIFY_DRAWER = "false"
  NETLIFY_FEEDBACK = "false"

[context.deploy-preview.environment]
  NETLIFY_DRAWER = "false"
  NETLIFY_FEEDBACK = "false"

[context.production.environment]
  NETLIFY_DRAWER = "false"
  NETLIFY_FEEDBACK = "false"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions."daily-summary-cron"]
  schedule = "*/15 * * * *"
```

---

## 3. Verification & Push
1. Verify TOML syntax with node TOML parser / schema check.
2. Commit and push the clean `netlify.toml` to GitHub `origin main`.
3. Monitor the Netlify build to confirm successful configuration parsing and deployment.
