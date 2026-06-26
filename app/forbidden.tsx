// Rendered (HTTP 403) when forbidden() is called — e.g. an admin hitting
// another tenant's subdomain, or a non-superadmin hitting /superadmin.
export default function Forbidden() {
  return (
    <main style={{ padding: 24, textAlign: "center" }}>
      <h1>৪০৩ — প্রবেশাধিকার নেই</h1>
      <p>এই পেজে আপনার প্রবেশের অনুমতি নেই।</p>
    </main>
  );
}
