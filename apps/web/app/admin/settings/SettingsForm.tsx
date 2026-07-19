'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateSettings } from '@/lib/actions/inquiries';
import type { Settings } from '@prisma/client';

export default function SettingsForm({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    defaultDepositPct: String(settings?.defaultDepositPct ?? 30),
    defaultMidpointPct: String(settings?.defaultMidpointPct ?? 40),
    defaultFinalPct: String(settings?.defaultFinalPct ?? 30),
    defaultTaxRate: String(settings?.defaultTaxRate ?? 13),
    companyName: settings?.companyName ?? 'Ecowoods Hardwood Flooring Inc.',
    companyAddress: settings?.companyAddress ?? '',
    companyPhone: settings?.companyPhone ?? '',
    companyEmail: settings?.companyEmail ?? '',
    companyNumberHst: settings?.companyNumberHst ?? '',
    aiBankTransferInstructions: settings?.aiBankTransferInstructions ?? '',
    aiEnabled: settings?.aiEnabled ?? false,
  });

  const set = (key: keyof typeof form, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const pctSum = parseFloat(form.defaultDepositPct) + parseFloat(form.defaultMidpointPct) + parseFloat(form.defaultFinalPct);

  const handleSave = async () => {
    if (Math.abs(pctSum - 100) > 0.01) {
      toast.error(`Invoice percentages must sum to 100% (currently ${pctSum}%).`);
      return;
    }
    setLoading(true);
    try {
      await updateSettings({
        defaultDepositPct: parseFloat(form.defaultDepositPct),
        defaultMidpointPct: parseFloat(form.defaultMidpointPct),
        defaultFinalPct: parseFloat(form.defaultFinalPct),
        defaultTaxRate: parseFloat(form.defaultTaxRate),
        companyName: form.companyName,
        companyAddress: form.companyAddress,
        companyPhone: form.companyPhone,
        companyEmail: form.companyEmail,
        companyNumberHst: form.companyNumberHst,
        aiBankTransferInstructions: form.aiBankTransferInstructions,
        aiEnabled: form.aiEnabled as boolean,
      });
      toast.success('Settings saved.');
      router.refresh();
    } catch {
      toast.error('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Invoice Staging */}
      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
          Default Invoice Staging Percentages
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          These defaults apply when creating new projects. Each project can override them individually.
          Must sum to 100%.
        </p>
        <div className="field-row">
          {[
            { key: 'defaultDepositPct', label: 'Deposit %' },
            { key: 'defaultMidpointPct', label: 'Midpoint %' },
            { key: 'defaultFinalPct', label: 'Final %' },
          ].map(({ key, label }) => (
            <div key={key} className="field">
              <label>{label}</label>
              <input
                type="number"
                value={form[key as keyof typeof form] as string}
                onChange={(e) => set(key as keyof typeof form, e.target.value)}
                min="0"
                max="100"
              />
            </div>
          ))}
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1px' }}>
            <div style={{ padding: '0.6rem 1rem', background: Math.abs(pctSum - 100) < 0.01 ? 'rgba(74,124,89,0.1)' : 'rgba(176,72,72,0.1)', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: Math.abs(pctSum - 100) < 0.01 ? 'var(--success)' : 'var(--danger)' }}>
              Total: {pctSum}%
            </div>
          </div>
        </div>

        <div className="field" style={{ maxWidth: 200 }}>
          <label>Default Tax Rate (HST %)</label>
          <input
            type="number"
            value={form.defaultTaxRate}
            onChange={(e) => set('defaultTaxRate', e.target.value)}
            min="0"
            max="20"
          />
          <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)', marginTop: '0.25rem' }}>
            Ontario HST = 13% · Quebec GST/QST = 14.975%
          </p>
        </div>
      </div>

      {/* Company Info */}
      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Company Info (used in PDF headers)</h2>
        <div className="field-row">
          <div className="field">
            <label>Company Name</label>
            <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </div>
          <div className="field">
            <label>HST Registration #</label>
            <input value={form.companyNumberHst} onChange={(e) => set('companyNumberHst', e.target.value)} placeholder="RT xxxx xxxx" />
          </div>
        </div>
        <div className="field">
          <label>Company Address</label>
          <input value={form.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Phone</label>
            <input value={form.companyPhone} onChange={(e) => set('companyPhone', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.companyEmail} onChange={(e) => set('companyEmail', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Bank Transfer */}
      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Bank Transfer Instructions</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          Shown to customers when they choose to pay by e-transfer.
        </p>
        <div className="field">
          <textarea
            rows={4}
            value={form.aiBankTransferInstructions}
            onChange={(e) => set('aiBankTransferInstructions', e.target.value)}
          />
        </div>
      </div>

      {/* AI */}
      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>AI Features</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Requires <code>OPENAI_API_KEY</code> in environment variables. When disabled, template-based responses are used instead.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.aiEnabled as boolean}
            onChange={(e) => set('aiEnabled', e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span>Enable AI-assisted replies and contract drafting</span>
        </label>
      </div>

      <div>
        <button onClick={handleSave} disabled={loading} className="btn btn-copper btn-lg">
          {loading ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Plaid integration note */}
      <div className="portal-card" style={{ background: 'rgba(26,15,8,0.03)', border: '1px dashed var(--line-strong)' }}>
        <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, marginBottom: '0.5rem' }}>
          🏦 Future: Automatic Bank Deposit Detection (Plaid)
        </h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.6 }}>
          <strong>Proposal:</strong> Plaid&apos;s Transactions API (Canada: TD, RBC, BMO, Scotiabank, CIBC) can automatically detect incoming e-transfers and match them to invoices by reference number.
          <br /><br />
          <strong>Requirements:</strong> Plaid Business account ($99/mo+), Business bank account at a supported institution, Plaid sandbox testing, customer consent flow.
          <br /><br />
          <strong>Implementation plan:</strong> See <code>lib/plaid.ts</code> for the scaffold. Activate by adding <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>, and <code>PLAID_ACCESS_TOKEN</code> to .env. The webhook handler at <code>/api/webhooks/plaid</code> will process transactions and auto-confirm matching payments.
        </p>
      </div>
    </div>
  );
}
