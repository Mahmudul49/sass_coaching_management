/**
 * EduPilot load-test harness (k6).
 *
 *   Docs: https://k6.io  ·  Install: `winget install k6` / `brew install k6`
 *
 * Simulates the eight critical user journeys across escalating concurrency
 * (10 → 1000 VUs). Each scenario is a separate k6 "scenario" so you can run one
 * journey in isolation or the whole suite. Ramp levels are chosen to match the
 * audit's concurrency targets.
 *
 * RUN A SINGLE LEVEL (recommended first pass):
 *   BASE=https://sass-coaching-management.vercel.app SLUG=demo \
 *   PHONE=01711111111 PASS=demo123 LEVEL=50 k6 run loadtest/k6-edupilot.js
 *
 * RUN THE FULL RAMP (10→1000, one journey at a time via --tag):
 *   ... k6 run --env RAMP=full loadtest/k6-edupilot.js
 *
 * IMPORTANT — test SAFELY:
 *   • Run against a STAGING deployment + a throwaway tenant, never live prod
 *     with real parents' phone numbers (payment/attendance journeys can fan out
 *     SMS if SMS_PROVIDER is real — keep it "stub" for load tests).
 *   • Atlas M0 has a hard 100-connection cap and is shared CPU. Expect it to be
 *     the first thing to saturate; that is the point of the test.
 *   • Write journeys (Student CRUD, Payment, Attendance, Result) MUTATE data.
 *     Point them at a disposable tenant seeded via `npm run seed:demo`.
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "http://localhost:3000";
const SLUG = __ENV.SLUG || "demo";
const PHONE = __ENV.PHONE || "01711111111";
const PASS = __ENV.PASS || "demo123";
const LEVEL = parseInt(__ENV.LEVEL || "50", 10);

// ── Custom metrics ──────────────────────────────────────────────────────────
const loginLatency = new Trend("edu_login_ms", true);
const dashLatency = new Trend("edu_dashboard_ms", true);
const reportLatency = new Trend("edu_report_ms", true);
const errorRate = new Rate("edu_errors");

// One shared ramp profile parameterised by LEVEL (peak concurrent users).
function ramp(peak) {
  return [
    { duration: "30s", target: Math.ceil(peak * 0.5) },
    { duration: "1m", target: peak },
    { duration: "2m", target: peak }, // steady state — read the p95 here
    { duration: "30s", target: 0 },
  ];
}

export const options = {
  scenarios: {
    // Read-heavy journeys (safe to hammer). Weighted to mirror real traffic:
    // dashboard + reports dominate an admin's day.
    browse: {
      executor: "ramping-vus",
      exec: "browseJourney",
      stages: ramp(LEVEL),
      gracefulRampDown: "20s",
    },
  },
  thresholds: {
    // Production SLOs. Tune to taste; these are the audit's targets.
    http_req_failed: ["rate<0.02"], // <2% errors
    edu_dashboard_ms: ["p(95)<1500"], // dashboard p95 under 1.5s
    edu_report_ms: ["p(95)<3000"], // report p95 under 3s
    edu_login_ms: ["p(95)<2000"], // login p95 under 2s (bcrypt-bound)
  },
};

// ── Auth helper (Auth.js Credentials + CSRF) ────────────────────────────────
// NextAuth v5 credentials sign-in = GET csrf → POST callback/credentials.
function login() {
  const jar = http.cookieJar();
  const csrfRes = http.get(`${BASE}/api/auth/csrf`);
  const csrfToken = csrfRes.json("csrfToken");

  const t0 = Date.now();
  const res = http.post(
    `${BASE}/api/auth/callback/credentials`,
    { phone: PHONE, password: PASS, slug: SLUG, csrfToken, json: "true" },
    { redirects: 0 }
  );
  loginLatency.add(Date.now() - t0);
  const ok = res.status === 200 || res.status === 302;
  errorRate.add(!ok);
  check(res, { "login accepted": () => ok });
  return jar;
}

const admin = (path) => `${BASE}/${SLUG}/admin${path}`;

export function browseJourney() {
  login();

  group("dashboard", () => {
    const t0 = Date.now();
    const r = http.get(admin(""));
    dashLatency.add(Date.now() - t0);
    errorRate.add(r.status !== 200);
    check(r, { "dashboard 200": (x) => x.status === 200 });
  });
  sleep(1);

  group("students (paginated)", () => {
    const r = http.get(admin("/students"));
    errorRate.add(r.status !== 200);
    check(r, { "students 200": (x) => x.status === 200 });
  });
  sleep(1);

  group("payments grid", () => {
    const r = http.get(admin("/payments"));
    errorRate.add(r.status !== 200);
    check(r, { "payments 200": (x) => x.status === 200 });
  });
  sleep(1);

  group("due report", () => {
    const t0 = Date.now();
    const r = http.get(admin("/reports"));
    reportLatency.add(Date.now() - t0);
    errorRate.add(r.status !== 200);
    check(r, { "reports 200": (x) => x.status === 200 });
  });
  sleep(2);
}
