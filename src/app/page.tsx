/**
 * Minimal placeholder. The backend spine is built first; the premium dashboard
 * UI comes later (feature/dashboard-ui). This page only confirms the app boots.
 */
export default function Page() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Empire OS</h1>
      <p>Backend spine is running. UI is built in a later phase.</p>
      <p>
        Health check: <code>/api/health</code>
      </p>
    </main>
  );
}
