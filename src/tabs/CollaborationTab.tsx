import React, { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  CircleUserRound,
  ClipboardCheck,
  MessageSquare,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

type TeamRole = 'Owner' | 'Artist' | 'Reviewer' | 'Guest';
type ReviewStatus = 'Draft' | 'In review' | 'Approved' | 'Changes requested';

interface Participant {
  id: string;
  name: string;
  role: TeamRole;
  addedAt: string;
}

interface BoardComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface HistoryEntry {
  id: string;
  text: string;
  createdAt: string;
}

interface CollaborationState {
  participants: Participant[];
  comments: BoardComment[];
  status: ReviewStatus;
  history: HistoryEntry[];
}

const STORAGE_KEY = 'minecraft-editor-local-collaboration-v1';
const roleOptions: TeamRole[] = ['Artist', 'Reviewer', 'Guest', 'Owner'];
const statusOptions: ReviewStatus[] = [
  'Draft',
  'In review',
  'Approved',
  'Changes requested',
];

const initialState: CollaborationState = {
  participants: [
    {
      id: 'local-owner',
      name: 'You',
      role: 'Owner',
      addedAt: new Date().toISOString(),
    },
  ],
  comments: [],
  status: 'Draft',
  history: [
    {
      id: 'initial',
      text: 'Local project board created',
      createdAt: new Date().toISOString(),
    },
  ],
};

const readBoard = (): CollaborationState => {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialState;
  const parsed: unknown = JSON.parse(saved);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'participants' in parsed &&
    'comments' in parsed &&
    'status' in parsed &&
    'history' in parsed
  ) {
    return parsed as CollaborationState;
  }
  throw new Error('Saved board data has an unexpected format.');
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export const CollaborationTab: React.FC = () => {
  const [board, setBoard] = useState<CollaborationState>(initialState);
  const [storageError, setStorageError] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [participantRole, setParticipantRole] = useState<TeamRole>('Artist');
  const [comment, setComment] = useState('');

  useEffect(() => {
    try {
      setBoard(readBoard());
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : 'Unable to load the local board.'
      );
    }
  }, []);

  const updateBoard = (update: (current: CollaborationState) => CollaborationState) => {
    setBoard((current) => {
      const next = update(current);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setStorageError('');
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? `Could not save this board locally: ${error.message}`
            : 'Could not save this board locally.'
        );
      }
      return next;
    });
  };

  const addHistory = (current: CollaborationState, text: string): HistoryEntry[] => [
    { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
    ...current.history,
  ].slice(0, 100);

  const addParticipant = (event: React.FormEvent) => {
    event.preventDefault();
    const name = participantName.trim();
    if (!name) return;
    updateBoard((current) => {
      const participant = {
        id: crypto.randomUUID(),
        name,
        role: participantRole,
        addedAt: new Date().toISOString(),
      };
      return {
        ...current,
        participants: [...current.participants, participant],
        history: addHistory(current, `${name} added as ${participantRole}`),
      };
    });
    setParticipantName('');
  };

  const changeRole = (id: string, role: TeamRole) => {
    updateBoard((current) => {
      const participant = current.participants.find((person) => person.id === id);
      if (!participant || participant.role === role) return current;
      return {
        ...current,
        participants: current.participants.map((person) =>
          person.id === id ? { ...person, role } : person
        ),
        history: addHistory(current, `${participant.name}'s role changed to ${role}`),
      };
    });
  };

  const removeParticipant = (id: string) => {
    updateBoard((current) => {
      const participant = current.participants.find((person) => person.id === id);
      if (!participant || participant.id === 'local-owner') return current;
      return {
        ...current,
        participants: current.participants.filter((person) => person.id !== id),
        history: addHistory(current, `${participant.name} removed from the board`),
      };
    });
  };

  const addComment = (event: React.FormEvent) => {
    event.preventDefault();
    const text = comment.trim();
    if (!text) return;
    updateBoard((current) => ({
      ...current,
      comments: [
        { id: crypto.randomUUID(), author: 'You', text, createdAt: new Date().toISOString() },
        ...current.comments,
      ].slice(0, 200),
      history: addHistory(current, 'You added a board comment'),
    }));
    setComment('');
  };

  const changeStatus = (status: ReviewStatus) => {
    updateBoard((current) =>
      current.status === status
        ? current
        : {
            ...current,
            status,
            history: addHistory(current, `Review status changed to ${status}`),
          }
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-4 text-gray-100 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-400">
              Local workspace
            </p>
            <h1 className="text-2xl font-bold">Project team board</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Keep a small participant list, notes, and review trail on this device.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <Users size={16} />
            Local only · not real-time or multi-user sync
          </div>
        </header>

        {storageError && (
          <div role="alert" className="rounded-lg border border-red-700 bg-red-950/60 p-3 text-sm text-red-200">
            Local storage issue: {storageError} Changes may not persist after closing this app.
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
          <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CircleUserRound className="text-blue-400" size={20} /> Participants
              </h2>
              <span className="rounded-full bg-gray-700 px-2.5 py-1 text-xs text-gray-300">
                {board.participants.length}
              </span>
            </div>
            <form onSubmit={addParticipant} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                placeholder="Participant name"
                aria-label="Participant name"
                maxLength={60}
                className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <select
                value={participantRole}
                onChange={(event) => setParticipantRole(event.target.value as TeamRole)}
                aria-label="Participant role"
                className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
              >
                {roleOptions.map((role) => <option key={role}>{role}</option>)}
              </select>
              <button
                type="submit"
                disabled={!participantName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Add
              </button>
            </form>
            <div className="space-y-2">
              {board.participants.map((participant) => (
                <div key={participant.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/70 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-950 text-sm font-bold text-blue-300">
                    {participant.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{participant.name}</div>
                    <div className="text-xs text-gray-500">Added {formatDate(participant.addedAt)}</div>
                  </div>
                  <select
                    value={participant.role}
                    onChange={(event) => changeRole(participant.id, event.target.value as TeamRole)}
                    aria-label={`${participant.name} role`}
                    className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200"
                  >
                    {roleOptions.map((role) => <option key={role}>{role}</option>)}
                  </select>
                  {participant.id !== 'local-owner' && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(participant.id)}
                      aria-label={`Remove ${participant.name}`}
                      className="rounded p-2 text-gray-500 hover:bg-red-950 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Participants are labels for your own planning. Adding someone here does not invite or notify them.
            </p>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <ClipboardCheck className="text-emerald-400" size={20} /> Review status
              </h2>
              <label htmlFor="review-status" className="mb-2 block text-sm text-gray-400">
                Current project checkpoint
              </label>
              <select
                id="review-status"
                value={board.status}
                onChange={(event) => changeStatus(event.target.value as ReviewStatus)}
                className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-300">
                <Check size={16} className="text-emerald-400" /> {board.status}
              </div>
            </section>

            <section className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <MessageSquare className="text-violet-400" size={20} /> Board comments
              </h2>
              <form onSubmit={addComment} className="space-y-2">
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write a note for this local project board…"
                  aria-label="New board comment"
                  maxLength={1000}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!comment.trim()}
                  className="w-full rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add comment
                </button>
              </form>
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">
                {board.comments.length === 0 ? (
                  <p className="text-sm text-gray-500">No comments yet. Add a note to start a local review thread.</p>
                ) : board.comments.map((item) => (
                  <article key={item.id} className="border-l-2 border-violet-700 pl-3">
                    <div className="flex flex-wrap justify-between gap-1 text-xs text-gray-500">
                      <span className="font-medium text-gray-300">{item.author}</span>
                      <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-300">{item.text}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Activity className="text-amber-400" size={20} /> Review history
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {board.history.map((entry) => (
              <li key={entry.id} className="flex gap-3 rounded-lg bg-gray-900/70 p-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                <div>
                  <p className="text-sm text-gray-200">{entry.text}</p>
                  <time dateTime={entry.createdAt} className="mt-1 block text-xs text-gray-500">
                    {formatDate(entry.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};
