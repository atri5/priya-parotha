# Dashboard PR review follow-up

1. **Committed credentials: not substantiated.** `backend/.env` and `backend/.dev.vars` are ignored and untracked. A scan of all fetched Git refs/history found neither file; only placeholder `.env.example` files are tracked. Local secret files are expected by the documented setup. No evidence from this review warrants rewriting Git history or rotating credentials. This check does not rule out disclosure outside Git.
2. **Write authorization:** deployed writes were already rejected. The HTTP check is now a named boundary with regression coverage for deployed hosts, missing flags, cross-origin requests, missing operation headers, and unsupported deletion. Product/storage helpers remain trusted server code. Admin authentication is still needed before deployed writes can be enabled.
3. **Photo validation:** the model now validates element types, nonblank values, allowed URL/path forms, reference length, and array count. HTTP upload handlers retain their file-signature and byte-limit checks.
4. **CSV concurrency:** a lock now covers the complete read/modify/replace operation. Competing writers fail explicitly; failures release the lock. Stale locks require deliberate recovery after confirming the writer has stopped. Production continues to use Neon.

Validation: focused model/API tests plus HTTP authorization regression checks, JavaScript syntax checks, and the production build. No live credentials or database data were changed for these fixes.
