'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchAvailability,
  submitAppointment,
  type AvailabilitySlot,
  type AppointmentFormData,
} from '@ecowoods/api-client';
import { APPOINTMENT_SERVICES, type AppointmentService } from '@ecowoods/shared';

type Step = 'date' | 'time' | 'details' | 'done';

const TZ = 'America/Toronto';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SERVICE_LABELS: Record<AppointmentService, string> = {
  'new-install': 'New Install',
  refinishing: 'Refinishing',
  'dust-free-sanding': 'Dust-Free Sanding',
  stairs: 'Stairs',
  'custom-inlays': 'Custom Inlays',
  commercial: 'Commercial',
};

function fmtDayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
}
function monthKey(y: number, m0: number) { return `${y}-${String(m0 + 1).padStart(2, '0')}`; }

export function BookingScheduler() {
  const [step, setStep] = useState<Step>('date');
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [confirmed, setConfirmed] = useState<{ whenLabel: string } | null>(null);

  const [form, setForm] = useState({
    name: '', phone: '', email: '', postal: '',
    service: '' as AppointmentService | '', sqft: '', notes: '', company: '',
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['availability'],
    queryFn: () => fetchAvailability(),
    staleTime: 60_000,
  });

  const slotsByDate = useMemo(() => {
    const m = new Map<string, AvailabilitySlot[]>();
    for (const d of data?.days ?? []) m.set(d.date, d.slots);
    return m;
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: AppointmentFormData) => submitAppointment(payload),
    onSuccess: (res) => {
      const label = new Date(res.startsAt).toLocaleString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ,
      });
      setConfirmed({ whenLabel: label });
      setStep('done');
      toast.success('Your estimate is booked!', { description: `Confirmed for ${label}. Check your email.` });
    },
    onError: (err: Error) => {
      toast.error("Couldn't confirm that time", {
        description: err.message || 'Please pick another or call (416) 249-1276',
      });
    },
  });

  const grid = useMemo(() => {
    const first = new Date(Date.UTC(viewYear, viewMonth, 1));
    const pad = first.getUTCDay();
    const days = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < pad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${monthKey(viewYear, viewMonth)}-${String(d).padStart(2, '0')}`);
    return cells;
  }, [viewYear, viewMonth]);

  const hasOpenings = (k: string) => (slotsByDate.get(k) ?? []).some((s) => s.available);
  const canPrev = monthKey(viewYear, viewMonth) > monthKey(today.getUTCFullYear(), today.getMonth());
  const selSlots = selectedDate ? (slotsByDate.get(selectedDate) ?? []).filter((s) => s.available) : [];

  const box: React.CSSProperties = {
    background: 'var(--surface, #fff)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-lg, 14px)', padding: '1.5rem', boxShadow: 'var(--shadow-warm)',
  };
  const cellBtn = (open: boolean): React.CSSProperties => ({
    aspectRatio: '1', borderRadius: 'var(--radius-md, 10px)', border: '1px solid var(--line)',
    background: open ? 'var(--paper, #fff)' : 'transparent',
    color: open ? 'var(--ink)' : 'var(--muted-soft, #bbb)',
    cursor: open ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.9rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
  });

  function go(payload?: Partial<typeof form>) {
    const f = { ...form, ...payload };
    if (!selectedSlot) return;
    if (!f.service) { toast.error('Choose a service'); return; }
    const data: AppointmentFormData = {
      startsAt: selectedSlot.start,
      name: f.name, email: f.email, phone: f.phone, postal: f.postal,
      service: f.service as AppointmentService,
      sqft: f.sqft ? Number(f.sqft) : undefined,
      notes: f.notes || undefined,
      company: f.company || '',
      source: 'web_scheduler',
    };
    mutation.mutate(data);
  }

  return (
    <div className="contact-form reveal" style={box}>
      {/* progress eyebrow */}
      <span className="eyebrow" style={{ color: 'var(--copper)', display: 'block', marginBottom: '0.75rem' }}>
        {step === 'done' ? 'Confirmed' : `Book in 3 steps · ${step === 'date' ? '1 Date' : step === 'time' ? '2 Time' : '3 Details'}`}
      </span>

      {step === 'date' && (
        <>
          <h3 style={{ marginBottom: '0.25rem' }}>Pick a day</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Free in-home estimate · Mon–Sat 8–7, Sun 10–4
          </p>
          {isLoading && <p style={{ color: 'var(--muted)' }}>Loading available dates…</p>}
          {isError && <p style={{ color: 'var(--danger)' }}>Couldn’t load the calendar. Call (416) 249-1276 to book.</p>}
          {!isLoading && !isError && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!canPrev}
                  onClick={() => { const m = viewMonth - 1; if (m < 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth(m); }}>←</button>
                <strong>{MONTHS[viewMonth]} {viewYear}</strong>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => { const m = viewMonth + 1; if (m > 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth(m); }}>→</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {grid.map((k, i) => k === null ? <div key={`p${i}`} /> : (
                  <button key={k} type="button" style={cellBtn(hasOpenings(k))} disabled={!hasOpenings(k)}
                    onClick={() => { setSelectedDate(k); setStep('time'); }}>
                    {Number(k.slice(-2))}
                    {hasOpenings(k) && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--copper)' }} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {step === 'time' && selectedDate && (
        <>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }}
            onClick={() => { setStep('date'); setSelectedSlot(null); }}>← Change date</button>
          <h3 style={{ marginBottom: '0.25rem' }}>{fmtDayLabel(selectedDate)}</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Choose a time</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8 }}>
            {selSlots.map((s) => (
              <button key={s.start} type="button" className="btn btn-ghost btn-sm"
                onClick={() => { setSelectedSlot(s); setStep('details'); }}>{fmtTime(s.start)}</button>
            ))}
          </div>
          {selSlots.length === 0 && <p style={{ color: 'var(--muted)' }}>No openings left this day.</p>}
        </>
      )}

      {step === 'details' && selectedSlot && (
        <>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }}
            onClick={() => setStep('time')}>← Change time</button>
          <h3 style={{ marginBottom: '0.25rem' }}>Your details</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            {fmtDayLabel(selectedSlot.start.slice(0, 10))} · {fmtTime(selectedSlot.start)} · {selectedSlot.durationMinutes} min
          </p>
          <div className="field-row">
            <div className="field"><label>Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></div>
            <div className="field"><label>Phone *</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(416) 249-1276" /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" /></div>
            <div className="field"><label>Postal Code *</label>
              <input maxLength={7} value={form.postal} onChange={(e) => setForm({ ...form, postal: e.target.value })} placeholder="M5V 3A8" /></div>
          </div>
          <div className="field"><label>Service *</label>
            <div className="field-radio-group">
              {APPOINTMENT_SERVICES.map((s) => (
                <label key={s} className={`field-radio ${form.service === s ? 'checked' : ''}`}>
                  <input type="radio" name="svc" value={s} checked={form.service === s}
                    onChange={() => setForm({ ...form, service: s })} />{SERVICE_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <div className="field-row">
            <div className="field"><label>Approx. Square Footage</label>
              <input type="number" value={form.sqft} onChange={(e) => setForm({ ...form, sqft: e.target.value })} placeholder="e.g. 1200" /></div>
          </div>
          <div className="field"><label>Project details (optional)</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          {/* honeypot */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, opacity: 0 }}
            value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <button type="button" className="btn btn-copper btn-lg" style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={mutation.isPending} onClick={() => go()}>
            {mutation.isPending ? 'Booking…' : 'Confirm my estimate →'}
          </button>
          <p className="form-disclosure" style={{ marginTop: '0.75rem' }}>Free and no obligation. We never share your information.</p>
        </>
      )}

      {step === 'done' && confirmed && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Your estimate is booked.</h3>
          <p style={{ color: 'var(--muted)' }}>
            {confirmed.whenLabel}. A senior estimator will confirm by email and arrive with species and finish samples.
          </p>
          <p style={{ color: 'var(--muted-soft, #999)', fontSize: '0.85rem', marginTop: '1rem' }}>Need to change it? Call (416) 249-1276.</p>
        </div>
      )}
    </div>
  );
}
