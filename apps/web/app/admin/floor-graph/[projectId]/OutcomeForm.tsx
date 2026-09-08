'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * The close-a-job form.
 *
 * TWO RULES IT KEEPS, BOTH OF WHICH MATTER MORE THAN THE UI.
 *
 * 1. A BLANK FIELD IS OMITTED, NEVER SENT AS ZERO. `numeric()` returns
 *    undefined for an empty string, and the payload is assembled by dropping
 *    undefined keys. Zero labour hours is a measurement; a blank box is an
 *    absence, and a schema that cannot tell them apart cannot be trained on.
 *
 * 2. NOTHING IS DERIVED. Schedule days is not computed from the start and end
 *    dates, material square footage is not copied from the quote. A derived
 *    value written into a measurement column is indistinguishable from a
 *    measurement six months later, and at that point the dataset is quietly
 *    worthless.
 *
 * Everything except the project itself is optional, on purpose. The realistic
 * failure mode for this page is not a wrong number — it is a form long enough
 * that nobody fills it in, and then there is no dataset at all.
 */
type Props = {
  projectId: string;
  defaultService: string | null;
  defaultCompletedOn: string | null;
  defaultSellingPriceCad: number | null;
};

function numeric(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function text(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export default function OutcomeForm({
  projectId,
  defaultService,
  defaultCompletedOn,
  defaultSellingPriceCad,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [service, setService] = useState(defaultService ?? '');
  const [completedOn, setCompletedOn] = useState(defaultCompletedOn ?? '');
  const [sellingPriceCad, setSellingPriceCad] = useState(
    defaultSellingPriceCad === null ? '' : String(Math.round(defaultSellingPriceCad)),
  );
  const [labourHours, setLabourHours] = useState('');
  const [machineHours, setMachineHours] = useState('');
  const [crewSize, setCrewSize] = useState('');
  const [gritSequence, setGritSequence] = useState('');
  const [finishCoats, setFinishCoats] = useState('');
  const [cureHours, setCureHours] = useState('');
  const [materialSqFt, setMaterialSqFt] = useState('');
  const [wastePct, setWastePct] = useState('');
  const [finishLitres, setFinishLitres] = useState('');
  const [materialCostCad, setMaterialCostCad] = useState('');
  const [labourCostCad, setLabourCostCad] = useState('');
  const [scheduleDays, setScheduleDays] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      projectId,
      service: text(service),
      completedOn: text(completedOn),
      sellingPriceCad: numeric(sellingPriceCad),
      labourHours: numeric(labourHours),
      machineHours: numeric(machineHours),
      crewSize: numeric(crewSize),
      gritSequence: text(gritSequence),
      finishCoats: numeric(finishCoats),
      cureHours: numeric(cureHours),
      materialSqFt: numeric(materialSqFt),
      wastePct: numeric(wastePct),
      finishLitres: numeric(finishLitres),
      materialCostCad: numeric(materialCostCad),
      labourCostCad: numeric(labourCostCad),
      scheduleDays: numeric(scheduleDays),
      notes: text(notes),
    };
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }

    try {
      const res = await fetch('/api/admin/floor-graph/outcome', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { predictionsClosed?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? String(res.status));
      toast.success(
        body.predictionsClosed
          ? `Outcome recorded. ${body.predictionsClosed} prediction(s) closed.`
          : 'Outcome recorded. No open prediction to close.',
      );
      router.push('/admin/floor-graph');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? `Could not record that: ${err.message}` : 'Could not record that.');
    } finally {
      setSaving(false);
    }
  };

  /* The house pattern is <div class="field"><label>…</label><input/></div> —
     globals.css styles `.field label`, so the label must be a CHILD of .field
     rather than wrapping it. The one thing added here is htmlFor/id, which the
     existing admin forms omit: a label that is neither wrapping nor associated
     is decoration, and this form has fifteen of them. */
  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    type: 'text' | 'number' | 'date' = 'text',
    hint?: string,
  ) => (
    <div className="field" key={id}>
      <label htmlFor={id}>
        {label}
        {hint ? ` — ${hint}` : ''}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        inputMode={type === 'number' ? 'decimal' : undefined}
        min={type === 'number' ? 0 : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    </div>
  );

  return (
    <div className="portal-card">
      <div className="portal-card-header">
            <h2>What actually happened</h2>
          </div>
      <p className="portal-subtitle">
        Only the selling price is worth stopping for — it is what closes the prediction. Leave
        anything you do not know blank; a blank field is recorded as unknown, never as zero.
      </p>

      <div className="field-row">
        {field('fg-service', 'Service', service, setService, 'text', 'e.g. full-sand-and-finish')}
        {field('fg-completed', 'Completed on', completedOn, setCompletedOn, 'date')}
        {field('fg-price', 'Sold for (CAD)', sellingPriceCad, setSellingPriceCad, 'number')}
        {field('fg-days', 'Schedule days', scheduleDays, setScheduleDays, 'number')}

        {field('fg-labour', 'Labour hours', labourHours, setLabourHours, 'number')}
        {field('fg-machine', 'Machine hours', machineHours, setMachineHours, 'number')}
        {field('fg-crew', 'Crew size', crewSize, setCrewSize, 'number')}
        {field('fg-grit', 'Grit sequence', gritSequence, setGritSequence, 'text', 'e.g. 36-60-80-100')}

        {field('fg-coats', 'Finish coats', finishCoats, setFinishCoats, 'number')}
        {field('fg-cure', 'Cure hours', cureHours, setCureHours, 'number')}
        {field('fg-matsqft', 'Material sq ft', materialSqFt, setMaterialSqFt, 'number')}
        {field('fg-waste', 'Waste %', wastePct, setWastePct, 'number')}

        {field('fg-litres', 'Finish litres', finishLitres, setFinishLitres, 'number')}
        {field('fg-matcost', 'Material cost (CAD)', materialCostCad, setMaterialCostCad, 'number')}
        {field('fg-labourcost', 'Labour cost (CAD)', labourCostCad, setLabourCostCad, 'number')}
      </div>

      <div className="field">
        <label htmlFor="fg-notes">Notes — optional</label>
        <textarea
          id="fg-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
      </div>

      <button type="button" className="btn btn-copper" onClick={submit} disabled={saving}>
        {saving ? 'Recording…' : 'Record outcome'}
      </button>
    </div>
  );
}
