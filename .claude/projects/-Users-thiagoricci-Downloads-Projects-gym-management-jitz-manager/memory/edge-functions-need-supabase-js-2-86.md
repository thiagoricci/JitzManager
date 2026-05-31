---
name: edge-functions-need-supabase-js-2-86
description: Edge functions must use supabase-js >= 2.86; project signs JWTs with ES256 asymmetric keys
metadata:
  type: project
---

The live Supabase project `ttaebhlbialxxsmgvreb` (JitzManager) signs user access tokens with **ES256 asymmetric JWT signing keys** (its JWKS publishes only an EC P-256 key; the legacy `eyJ...` HS256 anon key still works as an *apikey* but not for signing).

Edge functions were pinned to `@supabase/supabase-js@2.42.0`, which predates asymmetric signing keys — `supabase.auth.getUser(token)` rejected valid ES256 user tokens with `401 {"error":"Invalid token"}` (the function's own message, not the gateway). The frontend on `2.86.0` validated the same tokens fine, so REST worked while every getUser-based edge function failed.

**Why:** symptom looks like an auth/token bug but is purely an SDK-version incompatibility with the project's new signing keys.

**How to apply:** keep all edge-function `supabase-js` imports at `>= 2.86.0` (matching the frontend). When debugging edge-function 401s here, check the JWKS at `/auth/v1/.well-known/jwks.json` for the signing alg before assuming token expiry. Note: `supabase/config.toml` project_id was a stale `wdxusziaoimpfkpsebax`; corrected to `ttaebhlbialxxsmgvreb` (the CLI link via `.temp/project-ref` was already correct).
