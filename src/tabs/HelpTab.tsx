import React, { useMemo, useState } from 'react';
import { BookOpen, Bug, ChevronDown, Download, Search, Send, Sparkles } from 'lucide-react';

interface GuideItem {
  category: string;
  title: string;
  summary: string;
  steps: string[];
  keywords: string;
}

const guides: GuideItem[] = [
  {
    category: 'Getting started',
    title: 'Create a texture',
    summary: 'Set up a canvas and paint a pixel-art texture.',
    steps: [
      'Open Texture Editor and create or choose a canvas size suited to the Minecraft asset.',
      'Select a tool, set brush size and color, then draw on the canvas.',
      'Use the undo/redo controls as you iterate; keep an eye on the grid at pixel scale.',
      'Save or export your image from the available editor controls.',
    ],
    keywords: 'canvas paint brush color pixels editor draw',
  },
  {
    category: 'Animation',
    title: 'Build a simple animation',
    summary: 'Arrange frames and preview their timing.',
    steps: [
      'Open Animation Editor and add or select frames for the sequence.',
      'Edit each frame, then set a playback speed that keeps details readable.',
      'Preview the animation and adjust frames or timing before export.',
    ],
    keywords: 'frames fps animation playback preview',
  },
  {
    category: 'Resource packs',
    title: 'Prepare a resource pack',
    summary: 'Organize assets and set pack metadata.',
    steps: [
      'Use File Manager to inspect and organize your local project assets.',
      'Open Resource Pack Builder and enter the pack name and target format/version.',
      'Review the output structure and export using the controls available in that tab.',
    ],
    keywords: 'resource pack builder files metadata version export',
  },
  {
    category: 'Preview',
    title: 'Inspect a 3D preview',
    summary: 'Check how a texture reads on a model.',
    steps: [
      'Open 3D Preview after preparing an asset.',
      'Choose the available preview target and inspect the texture at several angles.',
      'Return to the editor to refine details that do not read clearly in 3D.',
    ],
    keywords: '3d model preview texture inspect',
  },
  {
    category: 'Local project board',
    title: 'Track a review locally',
    summary: 'Use Collaboration as a personal checklist, not a shared service.',
    steps: [
      'Add participant labels and select roles for your own project notes.',
      'Use comments to capture review feedback and the status selector to record a checkpoint.',
      'Everything is saved in this device’s local storage; no invitations, live updates, or sync are provided.',
    ],
    keywords: 'collaboration participants roles comments review status local offline',
  },
];

const shortcuts = [
  { keys: 'Ctrl / ⌘ + 1–9', action: 'Switch to tabs 1–9' },
  { keys: 'Ctrl / ⌘ + Z', action: 'Undo (where supported by the active editor)' },
  { keys: 'Ctrl / ⌘ + Shift + Z', action: 'Redo (where supported by the active editor)' },
  { keys: 'Esc', action: 'Close or cancel the active dialog (where supported)' },
];

const faqs = [
  {
    question: 'Where is my project data stored?',
    answer:
      'The app’s local features save supported settings and board/log data in this browser profile. Export important work regularly; clearing browser/app data may remove local records.',
  },
  {
    question: 'Can I collaborate with another person live?',
    answer:
      'No. The Collaboration tab is a local planning board only. It does not connect users, send invitations, sync projects, or update in real time.',
  },
  {
    question: 'Does Help or feedback contact support?',
    answer:
      'No network request is made. The feedback form below creates a text draft that you can save and share yourself.',
  },
  {
    question: 'Why do some features look different from a full editor workflow?',
    answer:
      'Available actions depend on the current build and the asset opened. Check the relevant tab and use its local controls; this guide does not imply remote services or integrations.',
  },
];

export const HelpTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [openGuide, setOpenGuide] = useState<string | null>(guides[0].title);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'Feedback' | 'Bug report'>('Feedback');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDetails, setFeedbackDetails] = useState('');
  const [formError, setFormError] = useState('');
  const [draftReady, setDraftReady] = useState(false);

  const filteredGuides = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return guides;
    return guides.filter((guide) =>
      `${guide.category} ${guide.title} ${guide.summary} ${guide.steps.join(' ')} ${guide.keywords}`
        .toLowerCase()
        .includes(needle)
    );
  }, [query]);

  const exportDraft = (event: React.FormEvent) => {
    event.preventDefault();
    if (!feedbackTitle.trim() || !feedbackDetails.trim()) {
      setFormError('Add both a short title and details before exporting your draft.');
      setDraftReady(false);
      return;
    }
    const draft = [
      `${feedbackType}: ${feedbackTitle.trim()}`,
      '',
      feedbackDetails.trim(),
      '',
      `Created locally: ${new Date().toLocaleString()}`,
      'This draft has not been sent anywhere.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([draft], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `texture-editor-${feedbackType.toLowerCase().replace(' ', '-')}-draft.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setFormError('');
    setDraftReady(true);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-4 text-gray-100 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-400">Offline reference</p>
            <h1 className="text-2xl font-bold">Help & learning</h1>
            <p className="mt-1 text-sm text-gray-400">Search the built-in guide, common questions, and keyboard shortcuts.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300">
            <Sparkles size={15} className="text-cyan-400" /> Available offline · no remote help service
          </div>
        </header>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides, topics, and FAQs"
            aria-label="Search help topics"
            className="w-full rounded-xl border border-gray-700 bg-gray-800 py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <section className="space-y-5">
            <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <BookOpen size={19} className="text-cyan-400" /> Guides & tutorials
              </h2>
              {filteredGuides.length ? (
                <div className="space-y-2">
                  {filteredGuides.map((guide) => {
                    const expanded = openGuide === guide.title;
                    return (
                      <article key={guide.title} className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70">
                        <button
                          type="button"
                          onClick={() => setOpenGuide(expanded ? null : guide.title)}
                          aria-expanded={expanded}
                          className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-gray-800"
                        >
                          <span>
                            <span className="block text-xs font-medium uppercase tracking-wide text-cyan-400">{guide.category}</span>
                            <span className="mt-1 block text-sm font-semibold text-gray-100">{guide.title}</span>
                            <span className="mt-0.5 block text-xs text-gray-400">{guide.summary}</span>
                          </span>
                          <ChevronDown size={18} className={`shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded && (
                          <ol className="space-y-2 border-t border-gray-800 px-4 py-3 text-sm text-gray-300">
                            {guide.steps.map((step, index) => (
                              <li key={step} className="flex gap-3">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs text-cyan-300">{index + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-gray-900 p-4 text-sm text-gray-400">No guides match “{query}”. Try another search phrase.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
              <h2 className="mb-4 text-lg font-semibold">Frequently asked questions</h2>
              <div className="space-y-2">
                {faqs.filter((faq) => {
                  const needle = query.trim().toLowerCase();
                  return !needle || `${faq.question} ${faq.answer}`.toLowerCase().includes(needle);
                }).map((faq) => {
                  const expanded = openFaq === faq.question;
                  return (
                    <article key={faq.question} className="rounded-lg border border-gray-700 bg-gray-900/70">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(expanded ? null : faq.question)}
                        aria-expanded={expanded}
                        className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm font-medium hover:bg-gray-800"
                      >
                        {faq.question}
                        <ChevronDown size={17} className={`shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && <p className="border-t border-gray-800 px-3 py-3 text-sm leading-relaxed text-gray-400">{faq.answer}</p>}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
              <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
              <dl className="space-y-3">
                {shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-700/70 pb-3 last:border-0 last:pb-0">
                    <dt className="text-sm text-gray-300">{shortcut.action}</dt>
                    <dd><kbd className="rounded border border-gray-600 bg-gray-900 px-2 py-1 font-mono text-xs text-cyan-200">{shortcut.keys}</kbd></dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-gray-500">Shortcut availability can vary by active tab and operating system.</p>
            </section>

            <section className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 sm:p-5">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
                {feedbackType === 'Bug report' ? <Bug size={19} className="text-amber-400" /> : <Send size={18} className="text-violet-400" />}
                Feedback draft
              </h2>
              <p className="mb-4 text-xs leading-relaxed text-gray-400">
                Create a text file to save or share yourself. Nothing is submitted or transmitted.
              </p>
              <form onSubmit={exportDraft} className="space-y-3">
                <label className="block text-xs font-medium text-gray-400">
                  Draft type
                  <select
                    value={feedbackType}
                    onChange={(event) => {
                      setFeedbackType(event.target.value as 'Feedback' | 'Bug report');
                      setDraftReady(false);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
                  >
                    <option>Feedback</option>
                    <option>Bug report</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-gray-400">
                  Short title
                  <input
                    value={feedbackTitle}
                    onChange={(event) => {
                      setFeedbackTitle(event.target.value);
                      setDraftReady(false);
                    }}
                    maxLength={120}
                    placeholder="What would you like to report?"
                    className="mt-1.5 w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-400">
                  Details
                  <textarea
                    value={feedbackDetails}
                    onChange={(event) => {
                      setFeedbackDetails(event.target.value);
                      setDraftReady(false);
                    }}
                    maxLength={4000}
                    rows={5}
                    placeholder="Describe what happened, expected behavior, and steps to reproduce."
                    className="mt-1.5 w-full resize-y rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none"
                  />
                </label>
                {formError && <p role="alert" className="text-sm text-red-300">{formError}</p>}
                {draftReady && <p role="status" className="text-sm text-emerald-300">Draft exported to a local text file. It has not been sent.</p>}
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold hover:bg-cyan-600">
                  <Download size={16} /> Export draft
                </button>
              </form>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};
