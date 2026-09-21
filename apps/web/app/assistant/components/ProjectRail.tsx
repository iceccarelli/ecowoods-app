'use client';

/**
 * ProjectRail — the left zone of the workspace shell.
 *
 * ASSISTANT-01: labels and empty-state copy only. No project state exists yet
 * (that's ASSISTANT-02), so every row here is a destination this workspace
 * will grow into, not a working control. Nothing here reads or writes a
 * price, a product, or a lead — see docs/assistant-workspace/PHASE_PLAN.md.
 */

const SECTIONS: { label: string; hint: string }[] = [
  { label: 'Overview', hint: 'Where this project stands' },
  { label: 'My floor', hint: 'Species, finish, pattern, width' },
  { label: 'Products', hint: 'From the Ecowoods catalogue' },
  { label: 'Services', hint: 'Installation, refinishing, and more' },
  { label: 'Scenarios', hint: 'Compare more than one plan' },
  { label: 'Savings', hint: 'Only where the math supports it' },
  { label: 'Potential value', hint: 'A labelled, ranged scenario' },
  { label: 'Evidence', hint: 'Where every number comes from' },
  { label: 'Compare', hint: 'Side by side' },
  { label: 'Saved', hint: 'Projects you’ve started' },
  { label: 'Documents', hint: 'Estimates and quotes' },
  { label: 'Next step', hint: 'Measure, estimate, or quote' },
];

export function ProjectRail() {
  return (
    <nav className="aha-rail aha-rail--project" aria-label="Project sections">
      <p className="aha-rail-heading">This project</p>
      <ul className="aha-rail-list">
        {SECTIONS.map((section) => (
          <li key={section.label} className="aha-rail-item" aria-disabled="true">
            <span className="aha-rail-item-label">{section.label}</span>
            <span className="aha-rail-item-hint">{section.hint}</span>
          </li>
        ))}
      </ul>
      <p className="aha-rail-note">
        Nothing is saved yet — start a conversation and this fills in as we go.
      </p>
    </nav>
  );
}
