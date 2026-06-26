// Single import point for the HTTP "interrupt" helpers so call sites don't each
// depend on the experimental import path. `forbidden()` renders app/forbidden.tsx
// with a 403; `unauthorized()` renders app/unauthorized.tsx with a 401.
export { forbidden, unauthorized } from "next/navigation";
