import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

export interface LibraryDeck {
  readonly id: string;
  readonly name: string;
  readonly cardCount: number;
  readonly dueCount: number;
  readonly folderId: string | null;
}
export interface LibraryFolder {
  readonly id: string;
  readonly name: string;
}
export interface LibraryCard {
  readonly id: string;
  readonly deckId: string;
  readonly front: string;
  readonly back: string;
  readonly phase: string;
  readonly dueAt: Date;
}
export interface StudyState {
  readonly sessionId: string;
  readonly itemId: string | null;
  readonly current: number;
  readonly total: number;
  readonly card: LibraryCard | null;
}
export interface ProgressData {
  readonly reviewedCards: number;
  readonly retentionPercent: number;
  readonly studyTimeMs: number;
  readonly days: readonly {
    readonly date: string;
    readonly reviewedCards: number;
  }[];
}
export interface CsvPreviewData {
  readonly fileName: string;
  readonly cards: readonly {
    readonly front: string;
    readonly back: string;
    readonly tags: readonly string[];
    readonly row: number;
  }[];
  readonly issues: readonly {
    readonly row: number;
    readonly message: string;
  }[];
}
export interface HafizaAppPort {
  loadLibrary(): Promise<readonly LibraryDeck[]>;
  loadCards(deckId: string, search?: string): Promise<readonly LibraryCard[]>;
  loadFolders(): Promise<readonly LibraryFolder[]>;
  createDeck(name: string, folderId?: string): Promise<void>;
  createFolder(name: string): Promise<void>;
  createCard(deckId: string, front: string, back: string): Promise<void>;
  editCard(id: string, front: string, back: string): Promise<void>;
  deleteCard(id: string): Promise<void>;
  startStudy(deckId?: string): Promise<StudyState>;
  revealStudy(itemId: string): Promise<void>;
  rateStudy(
    sessionId: string,
    itemId: string,
    rating: "again" | "hard" | "good" | "easy",
  ): Promise<StudyState>;
  loadProgress(): Promise<ProgressData>;
  previewCsv(fileName: string, content: string): Promise<CsvPreviewData>;
  previewXlsx(fileName: string, content: ArrayBuffer): Promise<CsvPreviewData>;
  importCards(preview: CsvPreviewData, deckId: string): Promise<number>;
  exportBackup(): Promise<string>;
  exportBackupFile(): Promise<ArrayBuffer>;
  decodeBackupFile(buffer: ArrayBuffer): Promise<string>;
  inspectBackup(serialized: string): {
    readonly exportedAt: string;
    readonly deckCount: number;
    readonly cardCount: number;
  };
  restoreBackup(serialized: string): Promise<void>;
  driveEnabled(): boolean;
  backupToDrive(): Promise<void>;
  restoreFromDrive(): Promise<void>;
  syncNow(): Promise<{ readonly pushed: number; readonly pulled: number }>;
  disconnectDrive(): void;
}
type View =
  | "today"
  | "library"
  | "deck"
  | "create"
  | "import"
  | "progress"
  | "settings"
  | "study";
const samples: readonly LibraryDeck[] = [
  {
    id: "sample-anatomy",
    name: "Anatomy",
    cardCount: 428,
    dueCount: 32,
    folderId: null,
  },
  {
    id: "sample-biochemistry",
    name: "Biochemistry",
    cardCount: 216,
    dueCount: 8,
    folderId: null,
  },
  {
    id: "sample-pharmacology",
    name: "Pharmacology",
    cardCount: 340,
    dueCount: 18,
    folderId: null,
  },
];
function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
function Button({
  children,
  secondary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`${secondary ? "border border-line bg-white text-ink" : "bg-primary text-white"} h-11 rounded-[10px] px-6 text-sm font-semibold transition hover:-translate-y-px disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
function Sidebar({
  view,
  setView,
}: {
  view: View;
  setView: (view: View) => void;
}) {
  const item = (target: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(target)}
      className={`h-10 w-full rounded-[10px] px-4 text-left text-sm ${view === target || (target === "library" && view === "deck") ? "bg-soft font-semibold" : "hover:bg-white/70"}`}
    >
      {label}
    </button>
  );
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[220px] flex-col border-r border-line bg-panel px-4 py-[30px] max-md:inset-x-0 max-md:bottom-auto max-md:h-16 max-md:w-full max-md:flex-row max-md:items-center max-md:py-2">
      <button
        className="mb-9 px-3 text-left text-lg font-semibold tracking-[1.2px] text-primary max-md:mb-0"
        onClick={() => setView("today")}
      >
        HAFIZA
      </button>
      <nav
        className="grid gap-2 max-md:ml-auto max-md:flex"
        aria-label="Primary navigation"
      >
        {item("today", "Today")}
        {item("library", "Library")}
        {item("progress", "Progress")}
        <span className="hidden max-md:block">
          {item("settings", "Settings")}
        </span>
      </nav>
      <button
        onClick={() => setView("settings")}
        className="mt-auto px-4 text-left text-sm text-muted max-md:hidden"
      >
        Settings
      </button>
    </aside>
  );
}
function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-10 flex items-end justify-between gap-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight text-title">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
function Today({
  decks,
  dueCount,
  setView,
  onStartStudy,
}: {
  decks: readonly LibraryDeck[];
  dueCount: number;
  setView: (view: View) => void;
  onStartStudy: () => void;
}) {
  const shown = decks.slice(0, 2);
  return (
    <>
      <PageHeading
        title="Good morning."
        subtitle="Here’s what needs your attention today."
      />
      <div className="grid grid-cols-[minmax(0,680px)_240px] gap-11 max-lg:grid-cols-1">
        <div>
          <section className="card h-[210px] p-7 shadow-card">
            <p className="eyebrow">TODAY’S LEARNING</p>
            <h2 className="mt-3 text-[30px] font-semibold">
              {dueCount} cards due
            </h2>
            <p className="mt-1 text-sm text-muted">About 18 minutes</p>
            <div className="mt-6">
              <Button onClick={onStartStudy}>Start review</Button>
            </div>
          </section>
          <h2 className="mb-5 mt-9 text-lg font-semibold">Continue learning</h2>
          <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
            {shown.map((deck) => (
              <button
                key={deck.id}
                onClick={() => setView("deck")}
                className="card h-[132px] p-5 text-left"
              >
                <strong>{deck.name}</strong>
                <span className="mt-3 block text-[13px] text-muted">
                  {deck.dueCount || 12} due • 72% learned
                </span>
                <span className="mt-7 block h-2 overflow-hidden rounded bg-soft">
                  <span className="block h-full w-[72%] bg-primary" />
                </span>
              </button>
            ))}
            {shown.length === 0 && (
              <p className="text-sm text-muted">
                Create a deck and add cards to begin learning.
              </p>
            )}
          </div>
        </div>
        <aside>
          <h2 className="mb-4 font-semibold">Quick actions</h2>
          <div className="card grid p-1">
            <button
              onClick={() => setView("create")}
              className="p-4 text-left text-sm font-medium"
            >
              + &nbsp;Create cards
            </button>
            <button
              onClick={() => setView("import")}
              className="p-4 text-left text-sm font-medium"
            >
              ↑ &nbsp;Import deck
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
function Library({
  decks,
  folders,
  setView,
  onAddDeck,
  onAddFolder,
  onSelectDeck,
}: {
  decks: readonly LibraryDeck[];
  folders: readonly LibraryFolder[];
  setView: (view: View) => void;
  onAddDeck: (event: FormEvent<HTMLFormElement>) => void;
  onAddFolder: (event: FormEvent<HTMLFormElement>) => void;
  onSelectDeck: (deckId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = decks.filter((deck) =>
    deck.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Library"
        subtitle="Organize and find your learning material."
        action={<Button onClick={() => setView("create")}>+ Create</Button>}
      />
      <div className="mb-9 grid grid-cols-[minmax(0,560px)_auto] gap-4 max-sm:grid-cols-1">
        <input
          className="field"
          placeholder="Search decks, cards, or tags…"
          aria-label="Search library"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <form onSubmit={onAddDeck} className="flex gap-2">
          <label className="sr-only" htmlFor="deck-name">
            New deck
          </label>
          <input
            id="deck-name"
            name="deckName"
            className="field"
            placeholder="New deck"
            required
          />
          <select name="folderId" aria-label="Deck folder" className="field">
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <Button type="submit">Add</Button>
        </form>
      </div>
      <h2 className="mb-4 font-semibold">Folders</h2>
      <div className="mb-8 flex gap-6 overflow-x-auto">
        {folders.map((folder) => (
          <div className="card min-w-[196px] p-4" key={folder.id}>
            <strong className="text-sm font-medium">{folder.name}</strong>
            <small className="mt-2 block text-muted">
              {decks.filter((deck) => deck.folderId === folder.id).length} decks
            </small>
          </div>
        ))}
        <form
          onSubmit={onAddFolder}
          className="card flex min-w-[250px] gap-2 p-3"
        >
          <label className="sr-only" htmlFor="folder-name">
            New folder
          </label>
          <input
            id="folder-name"
            name="folderName"
            className="field"
            placeholder="New folder"
            required
          />
          <Button type="submit">Add</Button>
        </form>
      </div>
      <h2 className="mb-5 text-lg font-semibold">Your decks</h2>
      <div className="grid gap-5">
        {shown.map((deck) => (
          <button
            type="button"
            key={deck.id}
            onClick={() => onSelectDeck(deck.id)}
            className="card flex h-[86px] items-center justify-between px-[18px] text-left"
          >
            <span>
              <strong className="block text-[15px]">{deck.name}</strong>
              <small className="mt-2 block text-muted">
                {deck.cardCount} cards
              </small>
            </span>
            <span className="mr-24 text-[13px] font-medium max-sm:mr-0">
              {deck.dueCount} due
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
function Deck({
  deck,
  setView,
  cards,
  search,
  onSearch,
  onStartStudy,
  onEditCard,
  onDeleteCard,
}: {
  deck: LibraryDeck | undefined;
  setView: (view: View) => void;
  cards: readonly LibraryCard[];
  search: string;
  onSearch: (text: string) => void;
  onStartStudy: () => void;
  onEditCard: (card: LibraryCard) => void;
  onDeleteCard: (card: LibraryCard) => void;
}) {
  const current = deck ?? samples[0]!;
  return (
    <>
      <button
        className="mb-6 text-xs text-muted"
        onClick={() => setView("library")}
      >
        ← Library
      </button>
      <PageHeading
        title={current.name}
        subtitle={`${current.cardCount} cards • Updated today`}
        action={<Button onClick={onStartStudy}>Start review</Button>}
      />
      <div className="card mb-11 grid h-[116px] grid-cols-3 p-7">
        {[
          [current.dueCount, "Due today"],
          [18, "Learning"],
          [306, "Mastered"],
        ].map(([n, label]) => (
          <div key={label}>
            <strong className="text-2xl">{n}</strong>
            <small className="mt-1 block text-muted">{label}</small>
          </div>
        ))}
      </div>
      <h2 className="mb-4 text-lg font-semibold">Cards</h2>
      <input
        className="field mb-6 max-w-[500px]"
        placeholder={`Search within ${current.name}…`}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <div className="grid gap-5">
        {cards.map((card) => (
          <div
            className="card flex min-h-[66px] items-center justify-between px-[18px] py-3"
            key={card.id}
          >
            <span>
              <strong className="text-sm">{card.front}</strong>
              <small className="mt-1 block text-muted">
                {card.phase} • due {card.dueAt.toLocaleDateString()}
              </small>
            </span>
            <span className="flex gap-3">
              <button
                onClick={() => onEditCard(card)}
                className="text-xs text-primary"
              >
                Edit
              </button>
              <button
                onClick={() => onDeleteCard(card)}
                className="text-xs text-red-700"
              >
                Delete
              </button>
            </span>
          </div>
        ))}
        {cards.length === 0 && (
          <p className="text-sm text-muted">No cards found in this deck.</p>
        )}
      </div>
    </>
  );
}
function CreateCard({
  decks,
  selectedDeckId,
  setSelectedDeckId,
  onAddCard,
  setView,
}: {
  decks: readonly LibraryDeck[];
  selectedDeckId: string;
  setSelectedDeckId: (id: string) => void;
  onAddCard: (event: FormEvent<HTMLFormElement>) => void;
  setView: (view: View) => void;
}) {
  const [front, setFront] = useState("");
  return (
    <>
      <PageHeading
        title="Create cards"
        subtitle="Turn your material into clear, reviewable knowledge."
      />
      <p className="mb-3 text-sm">Create with</p>
      <div className="mb-7 flex gap-4">
        <Button>Manual</Button>
        <Button secondary onClick={() => setView("import")}>
          Import
        </Button>
      </div>
      <form
        onSubmit={onAddCard}
        className="grid grid-cols-[minmax(0,600px)_310px] gap-8 max-lg:grid-cols-1"
      >
        <div className="card p-6">
          <label className="label">Question</label>
          <textarea
            name="front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            className="field min-h-[110px] resize-none"
            placeholder="Type the question or prompt…"
            required
          />
          <label className="label mt-6">Answer</label>
          <textarea
            name="back"
            className="field min-h-[140px] resize-none"
            placeholder="Write the answer…"
            required
          />
          <label className="label mt-5" htmlFor="card-deck">
            Deck
          </label>
          <select
            id="card-deck"
            name="deckId"
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="field"
            required
          >
            {decks.length === 0 && (
              <option value="">Create a deck first</option>
            )}
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="card h-[300px] p-5">
            <p className="eyebrow">PREVIEW</p>
            <strong className="mt-7 block">
              {front || "Which nerve innervates…"}
            </strong>
            <p className="mt-7 text-sm text-muted">Answer hidden</p>
          </div>
          <p className="my-5 text-xs text-muted">Preview before saving.</p>
          <Button type="submit" disabled={!decks.length}>
            Save card
          </Button>
        </div>
      </form>
    </>
  );
}
function Progress({ data }: { data: ProgressData | null }) {
  const recent = data?.days.slice(-7) ?? [];
  const max = Math.max(1, ...recent.map((day) => day.reviewedCards));
  const bars = Array.from({ length: 7 }, (_, index) => {
    const day = recent[index];
    return day ? Math.max(8, Math.round((day.reviewedCards / max) * 140)) : 8;
  });
  const studyMinutes = Math.round((data?.studyTimeMs ?? 0) / 60_000);
  return (
    <>
      <PageHeading title="Progress" subtitle="Is your studying working?" />
      <div className="mb-10 grid grid-cols-3 gap-6 max-sm:grid-cols-1">
        {[
          [`${data?.retentionPercent ?? 0}%`, "Retention"],
          [String(data?.reviewedCards ?? 0), "Cards reviewed"],
          [
            `${Math.floor(studyMinutes / 60)}h ${studyMinutes % 60}m`,
            "Study time",
          ],
        ].map(([v, l]) => (
          <div className="card h-28 p-5" key={l}>
            <strong className="text-2xl">{v}</strong>
            <small className="mt-2 block text-muted">{l}</small>
          </div>
        ))}
      </div>
      <h2 className="mb-4 text-lg font-semibold">This week</h2>
      <div className="grid grid-cols-[582px_330px] gap-8 max-xl:grid-cols-1">
        <div className="card h-[250px] p-5">
          <strong className="text-[13px]">Study activity</strong>
          <div className="mt-7 flex h-40 items-end justify-around">
            {bars.map((height, i) => (
              <div
                className="flex h-full flex-col justify-end text-center"
                key={i}
              >
                <span className="w-[34px] rounded bg-soft" style={{ height }} />
                <small className="mt-3 text-muted">{"MTWTFSS"[i]}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card h-[250px] p-5">
          <strong className="text-[13px]">Retention trend</strong>
          <b className="mt-7 block text-[34px]">
            {data?.retentionPercent ?? 0}%
          </b>
          <small className="text-muted">Stable over 30 days</small>
          <p className="mt-16 text-[11px] text-muted">
            Focus: useful feedback, not analytics overload.
          </p>
        </div>
      </div>
    </>
  );
}
function Study({
  application,
  state,
  setState,
  setView,
}: {
  application: HafizaAppPort;
  state: StudyState | null;
  setState: (state: StudyState) => void;
  setView: (view: View) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reveal = useCallback(() => {
    if (!state?.itemId || busy) return;
    setBusy(true);
    setError("");
    void application.revealStudy(state.itemId).then(
      () => {
        setRevealed(true);
        setBusy(false);
      },
      (reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "The answer could not be revealed.",
        );
        setBusy(false);
      },
    );
  }, [application, busy, state]);
  const rate = useCallback(
    (rating: "again" | "hard" | "good" | "easy") => {
      if (!state?.itemId || busy) return;
      setBusy(true);
      setError("");
      void application.rateStudy(state.sessionId, state.itemId, rating).then(
        (next) => {
          setState(next);
          setRevealed(false);
          setBusy(false);
        },
        (reason: unknown) => {
          setError(
            reason instanceof Error
              ? reason.message
              : "The rating could not be saved.",
          );
          setBusy(false);
        },
      );
    },
    [application, busy, setState, state],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!revealed && event.code === "Space") {
        event.preventDefault();
        reveal();
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        const ratings = ["again", "hard", "good", "easy"] as const;
        rate(ratings[Number(event.key) - 1]!);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rate, reveal, revealed]);
  const complete = state !== null && state.card === null;
  if (state === null)
    return <p className="p-10 text-muted">Preparing your local study queue…</p>;
  if (complete)
    return (
      <div className="mx-auto mt-16 max-w-[660px] text-center">
        <div className="card min-h-[540px] p-10 shadow-card">
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1 className="mt-6 text-3xl font-semibold">Nice work</h1>
          <p className="mt-2 text-muted">
            You finished today’s planned review.
          </p>
          <div className="my-14 grid grid-cols-3 gap-5 text-left">
            {[
              [String(state.total), "cards reviewed"],
              ["Saved", "offline"],
              ["100%", "completed"],
            ].map(([v, l]) => (
              <div className="card p-4" key={l}>
                <b className="text-2xl">{v}</b>
                <small className="block text-muted">{l}</small>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <Button onClick={() => setView("today")}>Done</Button>
            <Button secondary onClick={() => setView("progress")}>
              View progress
            </Button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="min-h-screen p-[42px] max-md:p-4">
      <div className="flex justify-between text-sm">
        <button onClick={() => setView("today")}>← Exit</button>
        <span className="text-muted">
          {state.current} / {state.total}
        </span>
      </div>
      <div className="mt-6 h-1.5 overflow-hidden rounded bg-soft">
        <div
          className="h-full bg-primary"
          style={{
            width: `${state.total === 0 ? 100 : (state.current / state.total) * 100}%`,
          }}
        />
      </div>
      <section
        className={`card mx-auto mt-[74px] max-w-[820px] p-9 shadow-card ${revealed ? "min-h-[470px]" : "min-h-[430px]"}`}
      >
        <p className="eyebrow">QUESTION</p>
        <h1
          className={`${revealed ? "mt-7 text-xl" : "mx-auto mt-24 max-w-[640px] text-2xl"} font-semibold`}
        >
          {state.card?.front}
        </h1>
        {revealed ? (
          <>
            <hr className="my-7 border-line" />
            <p className="eyebrow">ANSWER</p>
            <h2 className="ml-9 mt-7 text-2xl font-semibold">
              {state.card?.back}
            </h2>
          </>
        ) : (
          <div className="mt-28 text-center">
            <Button
              secondary
              disabled={busy || state.itemId === null}
              onClick={reveal}
            >
              Show answer
            </Button>
          </div>
        )}
      </section>
      {revealed ? (
        <div className="mx-auto mt-7 max-w-[760px] text-center">
          <p className="mb-5 text-sm">How well did you remember?</p>
          <div className="grid grid-cols-4 gap-6 max-sm:grid-cols-2">
            {[
              ["Again", "10 min"],
              ["Hard", "1 day"],
              ["Good", "4 days"],
              ["Easy", "10 days"],
            ].map(([r, t], index) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => {
                  const ratings = ["again", "hard", "good", "easy"] as const;
                  rate(ratings[index]!);
                }}
                className="card p-3 text-left"
              >
                <strong className="text-sm">{r}</strong>
                <small className="block text-muted">{t}</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-10 text-center text-xs text-muted">
          Space to reveal answer
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function ImportCards({
  application,
  decks,
  onImported,
}: {
  application: HafizaAppPort;
  decks: readonly LibraryDeck[];
  onImported: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<CsvPreviewData | null>(null);
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(
      file.name.toLocaleLowerCase().endsWith(".xlsx")
        ? await application.previewXlsx(file.name, await file.arrayBuffer())
        : await application.previewCsv(file.name, await file.text()),
    );
  }
  return (
    <>
      <PageHeading
        title="Import cards"
        subtitle="Preview your data before anything is added."
      />
      <div className="mb-8 flex gap-8 text-xs font-semibold text-muted">
        <span className="text-primary">1 Select file</span>
        <span>2 Analyze</span>
        <span>3 Preview</span>
        <span>4 Confirm</span>
        <span>5 Import</span>
      </div>
      <div className="grid grid-cols-[390px_520px] gap-8 max-xl:grid-cols-1">
        <section className="card min-h-[430px] p-6">
          <label className="label" htmlFor="csv-file">
            CSV file
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void selectFile(event)}
            className="field"
          />
          <label className="label mt-6" htmlFor="import-deck">
            Destination deck
          </label>
          <select
            id="import-deck"
            className="field"
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
          >
            <option value="">Choose a deck</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
          <p className="mt-8 text-sm text-muted">
            Supports CSV and XLSX. Required headers: Question/Answer or
            Front/Back. Optional: Tags.
          </p>
          {preview && (
            <p className="mt-5 text-sm">
              {preview.cards.length} valid rows • {preview.issues.length}{" "}
              warnings
            </p>
          )}
        </section>
        <section className="card min-h-[430px] p-6">
          <p className="eyebrow">PREVIEW</p>
          {preview?.cards[0] ? (
            <div className="mt-7">
              <small className="text-muted">Question</small>
              <p className="mt-2">{preview.cards[0].front}</p>
              <small className="mt-6 block text-muted">Answer</small>
              <p className="mt-2">{preview.cards[0].back}</p>
            </div>
          ) : (
            <p className="mt-8 text-sm text-muted">
              Choose a CSV file to analyze it locally.
            </p>
          )}
          {preview && preview.issues.length > 0 && (
            <ul className="mt-6 max-h-24 overflow-auto text-xs text-red-700">
              {preview.issues.map((issue) => (
                <li key={issue.row}>
                  Row {issue.row}: {issue.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-10">
            <Button
              disabled={!preview?.cards.length || !deckId || busy}
              onClick={() => {
                if (!preview) return;
                setBusy(true);
                void application
                  .importCards(preview, deckId)
                  .then(async (count) => {
                    await onImported();
                    setMessage(`Imported ${count} cards locally.`);
                    setBusy(false);
                  });
              }}
            >
              Import {preview?.cards.length ?? 0} cards
            </Button>
          </div>
          {message && (
            <p role="status" className="mt-4 text-sm text-primary">
              {message}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Settings({
  application,
  onRestored,
}: {
  application: HafizaAppPort;
  onRestored: () => Promise<void>;
}) {
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [driveStatus, setDriveStatus] = useState("");
  async function downloadBackup() {
    const compressed = await application.exportBackupFile();
    const url = URL.createObjectURL(
      new Blob([compressed], { type: "application/gzip" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hafiza-${new Date().toISOString().slice(0, 10)}.hafiza`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function inspect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await application.decodeBackupFile(await file.arrayBuffer());
    const info = application.inspectBackup(text);
    setRestoreText(text);
    setSummary(
      `${info.deckCount} decks and ${info.cardCount} cards • ${new Date(info.exportedAt).toLocaleString()}`,
    );
  }
  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="Your data stays on this device unless you export it."
      />
      <div className="grid max-w-[760px] gap-6">
        <section className="card p-6">
          <h2 className="font-semibold">Local backup</h2>
          <p className="my-3 text-sm text-muted">
            Export a versioned .hafiza recovery file containing decks, cards,
            review history, and settings.
          </p>
          <Button onClick={() => void downloadBackup()}>Export backup</Button>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Restore backup</h2>
          <p className="my-3 text-sm text-muted">
            The backup is validated and previewed before replacing local data.
          </p>
          <input
            type="file"
            accept=".hafiza,application/json"
            onChange={(event) => void inspect(event)}
            className="field"
          />
          {summary && (
            <div className="mt-4">
              <p className="mb-3 text-sm">{summary}</p>
              <Button
                secondary
                onClick={() => {
                  if (
                    !restoreText ||
                    !window.confirm(
                      "Replace local Hafiza data with this validated backup?",
                    )
                  )
                    return;
                  void application.restoreBackup(restoreText).then(onRestored);
                }}
              >
                Confirm restore
              </Button>
            </div>
          )}
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Google Drive</h2>
          <p className="my-3 text-sm text-muted">
            Optional private backup uses the app-data folder and the minimum
            Drive scope. Local study never waits for Drive.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!application.driveEnabled()}
              onClick={() => {
                setDriveStatus("Connecting…");
                void application.backupToDrive().then(
                  () => setDriveStatus("Backup uploaded."),
                  (error: unknown) =>
                    setDriveStatus(
                      error instanceof Error
                        ? error.message
                        : "Drive backup failed.",
                    ),
                );
              }}
            >
              Backup to Drive
            </Button>
            <Button
              secondary
              disabled={!application.driveEnabled()}
              onClick={() => {
                if (
                  !window.confirm(
                    "Replace local data with the latest Drive backup?",
                  )
                )
                  return;
                setDriveStatus("Downloading…");
                void application.restoreFromDrive().then(
                  async () => {
                    await onRestored();
                    setDriveStatus("Drive backup restored.");
                  },
                  (error: unknown) =>
                    setDriveStatus(
                      error instanceof Error
                        ? error.message
                        : "Drive restore failed.",
                    ),
                );
              }}
            >
              Restore from Drive
            </Button>
            <Button
              secondary
              disabled={!application.driveEnabled()}
              onClick={() => {
                setDriveStatus("Syncing local changes…");
                void application.syncNow().then(
                  ({ pushed, pulled }) =>
                    setDriveStatus(
                      `Sync complete: ${pushed} pushed, ${pulled} applied.`,
                    ),
                  (error: unknown) =>
                    setDriveStatus(
                      error instanceof Error ? error.message : "Sync failed.",
                    ),
                );
              }}
            >
              Sync now
            </Button>
            <Button secondary onClick={() => application.disconnectDrive()}>
              Disconnect
            </Button>
          </div>
          {!application.driveEnabled() && (
            <p className="mt-3 text-xs text-muted">
              Set VITE_GOOGLE_CLIENT_ID to enable this optional feature.
            </p>
          )}
          {driveStatus && (
            <p role="status" className="mt-3 text-sm text-primary">
              {driveStatus}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
export function App({ application }: { readonly application: HafizaAppPort }) {
  const [decks, setDecks] = useState<readonly LibraryDeck[]>([]);
  const [folders, setFolders] = useState<readonly LibraryFolder[]>([]);
  const [cards, setCards] = useState<readonly LibraryCard[]>([]);
  const [cardSearch, setCardSearch] = useState("");
  const [studyState, setStudyState] = useState<StudyState | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [status, setStatus] = useState("Loading your local library…");
  const [view, setView] = useState<View>("today");
  const refresh = useCallback(async () => {
    try {
      const [next, nextFolders] = await Promise.all([
        application.loadLibrary(),
        application.loadFolders(),
      ]);
      setDecks(next);
      setFolders(nextFolders);
      setSelectedDeckId((v) => v || next[0]?.id || "");
      setStatus(
        next.length
          ? "Saved on this device"
          : "Create your first deck to begin.",
      );
    } catch (error: unknown) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The local library could not be opened.",
      );
    }
  }, [application]);
  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);
  useEffect(() => {
    if (view !== "deck" || !selectedDeckId) return;
    let active = true;
    void application.loadCards(selectedDeckId, cardSearch).then((next) => {
      if (active) setCards(next);
    });
    return () => {
      active = false;
    };
  }, [application, cardSearch, selectedDeckId, view]);
  useEffect(() => {
    if (view !== "progress") return;
    let active = true;
    void application.loadProgress().then((next) => {
      if (active) setProgress(next);
    });
    return () => {
      active = false;
    };
  }, [application, view]);
  async function addDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    try {
      const form = new FormData(el);
      await application.createDeck(
        formText(form, "deckName"),
        formText(form, "folderId") || undefined,
      );
      el.reset();
      await refresh();
    } catch (error: unknown) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The deck could not be created.",
      );
    }
  }
  async function addFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    await application.createFolder(formText(new FormData(el), "folderName"));
    el.reset();
    await refresh();
  }
  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    const form = new FormData(el);
    try {
      await application.createCard(
        formText(form, "deckId"),
        formText(form, "front"),
        formText(form, "back"),
      );
      el.reset();
      await refresh();
      setView("library");
    } catch (error: unknown) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The card could not be created.",
      );
    }
  }
  function selectDeck(deckId: string) {
    setSelectedDeckId(deckId);
    setCardSearch("");
    setView("deck");
  }
  async function startStudy(deckId?: string) {
    try {
      setStatus("Preparing your local study queue…");
      setView("study");
      setStudyState(await application.startStudy(deckId));
      setStatus("Study session saved locally");
    } catch (error: unknown) {
      setView("today");
      setStatus(
        error instanceof Error
          ? error.message
          : "The study session could not start.",
      );
    }
  }
  async function editCard(card: LibraryCard) {
    const front = window.prompt("Question", card.front);
    if (front === null) return;
    const back = window.prompt("Answer", card.back);
    if (back === null) return;
    await application.editCard(card.id, front, back);
    setCards(await application.loadCards(card.deckId, cardSearch));
  }
  async function deleteCard(card: LibraryCard) {
    if (!window.confirm("Move this card to the deleted-items recovery state?"))
      return;
    await application.deleteCard(card.id);
    setCards(await application.loadCards(card.deckId, cardSearch));
    await refresh();
  }
  const dueCount = useMemo(
    () => decks.reduce((sum, d) => sum + d.dueCount, 0),
    [decks],
  );
  const selected = decks.find((d) => d.id === selectedDeckId);
  return (
    <div className="min-h-screen bg-canvas text-ink">
      {view !== "study" && <Sidebar view={view} setView={setView} />}
      <main
        className={`${view === "study" ? "ml-0 max-w-none p-0" : "ml-[220px] max-w-[1060px] px-12 py-[46px] max-md:ml-0 max-md:pt-24"} min-h-screen`}
      >
        <span role="status" className="sr-only">
          {status}
        </span>
        {view === "today" && (
          <Today
            decks={decks}
            dueCount={dueCount}
            setView={setView}
            onStartStudy={() => void startStudy()}
          />
        )}{" "}
        {view === "library" && (
          <Library
            decks={decks}
            folders={folders}
            setView={setView}
            onAddDeck={(e) => void addDeck(e)}
            onAddFolder={(e) => void addFolder(e)}
            onSelectDeck={selectDeck}
          />
        )}{" "}
        {view === "deck" && (
          <Deck
            deck={selected}
            setView={setView}
            cards={cards}
            search={cardSearch}
            onSearch={setCardSearch}
            onStartStudy={() => void startStudy(selectedDeckId)}
            onEditCard={(card) => void editCard(card)}
            onDeleteCard={(card) => void deleteCard(card)}
          />
        )}{" "}
        {view === "create" && (
          <CreateCard
            decks={decks}
            selectedDeckId={selectedDeckId}
            setSelectedDeckId={setSelectedDeckId}
            onAddCard={(e) => void addCard(e)}
            setView={setView}
          />
        )}{" "}
        {view === "import" && (
          <ImportCards
            application={application}
            decks={decks}
            onImported={refresh}
          />
        )}{" "}
        {view === "progress" && <Progress data={progress} />}{" "}
        {view === "settings" && (
          <Settings application={application} onRestored={refresh} />
        )}{" "}
        {view === "study" && (
          <Study
            application={application}
            state={studyState}
            setState={setStudyState}
            setView={setView}
          />
        )}
      </main>
    </div>
  );
}
