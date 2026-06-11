import { db } from '@/lib/db';
import SettingsForm from './SettingsForm';

export default async function AdminSettingsPage() {
  const settings = await db.settings.findFirst();

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Settings</h1>
          <p className="portal-subtitle">Global defaults for invoices, taxes, and company info</p>
        </div>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
