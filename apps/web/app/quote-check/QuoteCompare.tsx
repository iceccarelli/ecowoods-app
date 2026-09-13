'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import Link from 'next/link';
import { SCOPE_ITEMS, SCOPE_GROUPS, compare, type QuoteInput } from '@/lib/quote-check';

/**
 * The comparator.
 *
 * Everything here runs in the browser. No quote, no total, no company name and
 * no file is sent anywhere by this component — there is no fetch in it. That is
 * a deliberate constraint, not an oversight: the visitor is holding other
 * companies' commercial documents, and the moment a tool like this uploads them
 * it stops being usable by the people who most need it.
 *
 * The result never ranks the quotes and never recommends one. It reports where
 * the scopes differ and hands back the question to ask.
 */
const BLANK = (label: string): QuoteInput => ({ label, includes: [] });

function money(v: string): number | undefined {
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function QuoteCompare() {
  const [quotes, setQuotes] = useState<QuoteInput[]>([BLANK('Quote 1'), BLANK('Quote 2')]);
  const [raw, setRaw] = useState<{ total: string; area: string }[]>([
    { total: '', area: '' },
    { total: '', area: '' },
  ]);

  const result = useMemo(() => compare(quotes), [quotes]);

  /* MEAS-03 — this tool had ZERO analytics either. Fires once, and only when
     two quotes both carry a real total, because that is the first moment a
     COMPARISON exists; before it the visitor is still typing.

     The event carries a count and nothing else. No total, no area, no company
     name, no line item. The page promises three times over that nothing is
     uploaded and nothing is stored, and an analytics event carrying any of
     the figures would make that sentence false — which matters more here than
     anywhere else on the site, because the visitor is holding another
     company's commercial document. */
  const comparedRef = useRef(false);
  useEffect(() => {
    if (comparedRef.current) return;
    const priced = quotes.filter((q) => typeof q.total === 'number' && q.total > 0).length;
    if (priced < 2) return;
    comparedRef.current = true;
    track('quote_check_compared', { quotes: priced });
  }, [quotes]);

  const setQuote = (i: number, patch: Partial<QuoteInput>) =>
    setQuotes((prev) => prev.map((q, n) => (n === i ? { ...q, ...patch } : q)));

  const setRawAt = (i: number, patch: Partial<{ total: string; area: string }>) =>
    setRaw((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const toggle = (i: number, id: string) =>
    setQuotes((prev) =>
      prev.map((q, n) =>
        n === i
          ? { ...q, includes: q.includes.includes(id) ? q.includes.filter((x) => x !== id) : [...q.includes, id] }
          : q,
      ),
    );

  const addQuote = () => {
    if (quotes.length >= 4) return;
    setQuotes((prev) => [...prev, BLANK(`Quote ${prev.length + 1}`)]);
    setRaw((prev) => [...prev, { total: '', area: '' }]);
  };

  const removeQuote = (i: number) => {
    if (quotes.length <= 2) return;
    setQuotes((prev) => prev.filter((_, n) => n !== i));
    setRaw((prev) => prev.filter((_, n) => n !== i));
  };

  return (
    <>
      <div className="tlx-table-wrap" role="region" tabIndex={0} aria-label="The quotes you are holding">
        <table className="wm-table">
          <caption className="tlx-kicker">
            Tick what each document actually says. Leave anything you cannot find unticked — that is the
            answer, not a gap in the form.
          </caption>
          <thead>
            <tr>
              <th scope="col">Line item</th>
              {quotes.map((q, i) => (
                <th scope="col" key={i}>
                  <label className="tlx-kicker" htmlFor={`qc-label-${i}`}>
                    Your name for it
                  </label>
                  <input
                    id={`qc-label-${i}`}
                    type="text"
                    value={q.label}
                    onChange={(e) => setQuote(i, { label: e.target.value })}
                    aria-label={`Name for quote ${i + 1}`}
                  />
                  {quotes.length > 2 && (
                    <button type="button" onClick={() => removeQuote(i)} aria-label={`Remove ${q.label}`}>
                      Remove
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total on the document</th>
              {quotes.map((q, i) => (
                <td key={i}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={raw[i]?.total ?? ''}
                    placeholder="$"
                    aria-label={`Total for ${q.label}`}
                    onChange={(e) => {
                      setRawAt(i, { total: e.target.value });
                      setQuote(i, { total: money(e.target.value) });
                    }}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Area it covers (sq ft)</th>
              {quotes.map((q, i) => (
                <td key={i}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={raw[i]?.area ?? ''}
                    placeholder="sq ft"
                    aria-label={`Area for ${q.label}`}
                    onChange={(e) => {
                      setRawAt(i, { area: e.target.value });
                      setQuote(i, { areaSqFt: money(e.target.value) });
                    }}
                  />
                </td>
              ))}
            </tr>

            {SCOPE_GROUPS.map((group) => (
              <Fragment key={group}>
                <tr>
                  <th scope="rowgroup" colSpan={quotes.length + 1}>
                    {group}
                  </th>
                </tr>
                {SCOPE_ITEMS.filter((it) => it.group === group).map((it) => (
                  <tr key={it.id}>
                    <th scope="row">
                      {it.label}
                      {it.cite && (
                        <>
                          {' '}
                          <Link href={it.cite} className="tlx-kicker">
                            why
                          </Link>
                        </>
                      )}
                    </th>
                    {quotes.map((q, i) => (
                      <td key={i}>
                        <input
                          type="checkbox"
                          checked={q.includes.includes(it.id)}
                          onChange={() => toggle(i, it.id)}
                          aria-label={`${it.label} — ${q.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {quotes.length < 4 && (
        <p>
          <button type="button" onClick={addQuote}>
            Add another quote
          </button>
        </p>
      )}

      <div className="wm-result" role="status" aria-live="polite" style={{ position: 'static', marginTop: '2rem' }}>
        <p className="tlx-kicker">What the arithmetic supports</p>
        <p className="wm-sub">{result.statement}</p>

        {result.readings.some((r) => typeof r.perSqFt === 'number') && (
          <dl className="wm-dl">
            {result.readings
              .filter((r) => typeof r.perSqFt === 'number')
              .map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>${r.perSqFt?.toFixed(2)} / sq ft</dd>
                </div>
              ))}
          </dl>
        )}

        {result.readings.some((r) => r.missingScope.length > 0) && (
          <>
            <p className="tlx-kicker">Priced by one and not the other</p>
            <ul className="wm-caveats">
              {result.readings
                .filter((r) => r.missingScope.length > 0)
                .map((r) => (
                  <li key={r.label}>
                    <strong>{r.label}</strong> does not mention{' '}
                    {r.missingScope.map((i) => i.label.toLowerCase()).join('; ')}. Ask what those cost before
                    you compare the totals.
                  </li>
                ))}
            </ul>
          </>
        )}

        {result.absentEverywhere.length > 0 && result.verdict !== 'insufficient' && (
          <>
            <p className="tlx-kicker">In none of them — one question for all of them</p>
            <ul className="wm-caveats">
              {result.absentEverywhere.map((i) => (
                <li key={i.id}>
                  {i.label}. {i.why}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="wm-sub">
          This tool prices nothing. It cannot tell you what subfloor preparation should cost, because no
          honest source publishes that figure for your house — which is the same reason the quotes differ.
          The output is the question to put back to each company.
        </p>
      </div>
    </>
  );
}
