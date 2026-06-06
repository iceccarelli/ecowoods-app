'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateProjectStatus, addProjectNote } from '@/lib/actions/projects';
import type { Project, ProjectStatus } from '@prisma/client';

const STATUSES: ProjectStatus[] = [
  'DRAFT', 'CONTRACT_SENT', 'SIGNED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
];

export default function ProjectStatusForm({ project }: { project: Project }) {
  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  const handleStatusUpdate = async () => {
    setLoading(true);
    try {
      await updateProjectStatus(project.id, status);
      toast.success('Project status updated.');
      router.refresh();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setNoteLoading(true);
    try {
      await addProjectNote(project.id, note.trim());
      toast.success('Note added.');
      setNote('');
      router.refresh();
    } catch {
      toast.error('Failed to add note.');
    } finally {
      setNoteLoading(false);
    }
  };

  return (
    <>
      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Project Status</h2>
        <div className="field">
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleStatusUpdate}
          disabled={loading || status === project.status}
          className="btn btn-copper btn-sm"
          style={{ width: '100%' }}
        >
          {loading ? 'Updating…' : 'Update Status'}
        </button>
      </div>

      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Add Internal Note</h2>
        <div className="field">
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes visible only to admin staff..."
          />
        </div>
        <button
          onClick={handleAddNote}
          disabled={noteLoading || !note.trim()}
          className="btn btn-ghost btn-sm"
          style={{ width: '100%' }}
        >
          {noteLoading ? 'Adding…' : 'Add Note'}
        </button>
      </div>
    </>
  );
}
