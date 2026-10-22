import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { deployFacts, evaluateConfig, type ConfigLevel } from '@/lib/config-status';

/**
 * /admin/system — which settings the deployed code reads are configured.
 *
 * Read-only: no action, no mutation, no external call. For each setting it
 * shows only whether it is set and non-empty — never a value, length, prefix
 * or hash (see lib/config-status.ts). Evaluated per request against the
 * running deployment's environment.
 */
export const dynamic = 'force-dynamic';

const LEVEL_STYLE: Record<ConfigLevel, { bg: string; label: string }> = {
  red: { bg: '#b91c1c', label: 'Action needed' },
  amber: { bg: '#b45309', label: 'Attention' },
  green: { bg: '#15803d', label: 'All set' },
};

export default async function AdminSystemPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/login');

  const model = evaluateConfig(process.env);
  const deploy = deployFacts(process.env);
  const style = LEVEL_STYLE[model.level];

  return (
    <main className="admin-page">
      <h1>System status</h1>
      <p className="admin-sub">
        Whether each setting the site reads is configured. Values are never shown, and a setting being present does not prove it is correct.
      </p>

      <section
        className="admin-card"
        role="status"
        aria-label={`System status: ${model.headline}`}
        style={{ borderLeft: `6px solid ${style.bg}` }}
      >
        <h2>
          <span style={{ background: style.bg, color: '#fff', borderRadius: '999px', padding: '0.1rem 0.7rem', fontSize: '0.85rem', marginRight: '0.6rem' }}>
            {style.label}
          </span>
          {model.headline}
        </h2>
        <p className="admin-note">
          Missing: {model.missing.critical} critical, {model.missing.important} important, {model.missing.optional} optional.
        </p>
      </section>

      <section className="admin-card">
        <h2>Deployment</h2>
        <table className="admin-table">
          <tbody>
            <tr><td>Commit</td><td>{deploy.commit ? <code>{deploy.commit}</code> : 'not reported'}</td></tr>
            <tr><td>Environment</td><td>{deploy.environment ?? 'not reported'}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Settings</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Setting</th><th>Status</th><th>Severity</th><th>Group</th><th>If missing</th></tr>
          </thead>
          <tbody>
            {model.items.map((i) => (
              <tr key={i.key}>
                <td><code>{i.key}</code></td>
                <td>{i.configured ? 'Configured' : 'Missing'}</td>
                <td>{i.severity}</td>
                <td>{i.group}</td>
                <td className={i.configured ? 'admin-muted' : undefined}>{i.breaks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
