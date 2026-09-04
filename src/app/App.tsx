import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ChevronDown } from "lucide-react";

import { measureOperation } from "@shared/index";

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
export interface SyncStatusData {
  readonly phase: "idle" | "syncing" | "synced" | "error";
  readonly message: string;
  readonly lastSyncedAt: Date | null;
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
  syncIfConnected(): Promise<{
    readonly pushed: number;
    readonly pulled: number;
  } | null>;
  subscribeSyncStatus(listener: (status: SyncStatusData) => void): () => void;
  disconnectDrive(): void;
}
type View =
  | "today"
  | "library"
  | "deck"
  | "create"
  | "edit"
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
function failureMessage(error: unknown, fallback: string): string {
  if (
    error instanceof DOMException &&
    ["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name)
  ) {
    return "This device is out of storage. Export a backup, then free browser storage before trying again.";
  }
  return error instanceof Error ? error.message : fallback;
}
function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    "primary" | "secondary" | "ghost" | "danger" | "inverted" | "onDark";
}) {
  const styles = {
    primary: "bg-primary text-white shadow-sm hover:bg-primary-dark",
    secondary: "border border-line bg-white text-ink hover:border-primary/30",
    ghost: "bg-transparent text-ink hover:bg-soft",
    danger: "bg-[#fae3de] text-red-800 hover:bg-[#f6d2ca]",
    inverted: "bg-white text-primary shadow-sm hover:bg-white/90",
    onDark:
      "border border-white/25 bg-transparent text-white hover:bg-white/10",
  };
  return (
    <button
      {...props}
      className={`${styles[variant]} min-h-11 rounded-[10px] px-5 text-sm font-semibold transition hover:-translate-y-px disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
function SelectField({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block min-w-0">
      <select
        {...props}
        className={`field peer appearance-none pr-11 ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={2}
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted transition peer-focus:text-primary peer-disabled:opacity-40"
      />
    </span>
  );
}
function Sidebar({
  view,
  setView,
  syncStatus,
}: {
  view: View;
  setView: (view: View) => void;
  syncStatus: SyncStatusData;
}) {
  const item = (target: View, label: string, shortLabel: string) => {
    const active =
      view === target ||
      (target === "library" && ["deck", "edit", "import"].includes(view)) ||
      (target === "create" && view === "create") ||
      (target === "today" && view === "study");
    return (
      <button
        type="button"
        onClick={() => setView(target)}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`group flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-sm transition md:w-full md:flex-none md:flex-row md:gap-3 md:px-3 lg:justify-start lg:px-4 ${active ? "bg-soft font-semibold text-primary" : "text-muted hover:bg-white hover:text-ink"}`}
      >
        <span
          aria-hidden="true"
          className={`grid size-7 place-items-center rounded-lg text-[11px] font-bold ${active ? "bg-primary text-white" : "bg-white text-muted group-hover:bg-soft"}`}
        >
          {shortLabel}
        </span>
        <span className="hidden lg:inline">{label}</span>
        <span className="text-[10px] md:hidden">{label}</span>
      </button>
    );
  };
  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] border-t border-line bg-panel/95 px-2 backdrop-blur md:inset-y-0 md:right-auto md:h-auto md:w-[88px] md:flex-col md:border-r md:border-t-0 md:px-3 md:py-8 lg:w-[248px] lg:px-5">
      <button
        aria-label="Hafiza home"
        className="mb-10 hidden items-center justify-center gap-3 px-1 text-left md:flex lg:justify-start lg:px-3"
        onClick={() => setView("today")}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-base font-bold text-white shadow-card">
          H
        </span>
        <span className="hidden lg:block">
          <strong className="block text-[17px] tracking-[1.4px] text-primary">
            HAFIZA
          </strong>
          <small className="text-[10px] font-medium text-muted">
            Learn with intention
          </small>
        </span>
      </button>
      <nav
        className="flex w-full items-center gap-1 md:grid md:gap-2"
        aria-label="Primary navigation"
      >
        {item("today", "Today", "T")}
        {item("library", "Library", "L")}
        {item("create", "Create", "+")}
        {item("progress", "Progress", "P")}
        {item("settings", "Settings", "S")}
      </nav>
      <div className="mt-auto hidden rounded-xl border border-line bg-white/75 p-4 lg:block">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span
            className={`size-2 rounded-full ${syncStatus.phase === "error" ? "bg-red-500" : syncStatus.phase === "syncing" ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`}
          />
          <span className="truncate">{syncStatus.message}</span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          Your learning stays available offline.
        </p>
      </div>
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
  action?: React.ReactNode | undefined;
}) {
  return (
    <header className="mb-8 flex items-end justify-between gap-5 max-sm:items-start max-sm:flex-col">
      <div>
        <h1 className="text-[clamp(1.65rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.025em] text-title">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {subtitle}
        </p>
      </div>
      {action}
    </header>
  );
}
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      previouslyFocused?.focus();
    };
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-title/35 p-4 backdrop-blur-sm">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="card w-full max-w-md p-6 shadow-float"
      >
        <h2 id="confirm-title" className="text-xl font-semibold">
          {title}
        </h2>
        <p
          id="confirm-description"
          className="mt-3 text-sm leading-6 text-muted"
        >
          {description}
        </p>
        <div className="mt-7 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
function Today({
  decks,
  dueCount,
  progress,
  setView,
  onSelectDeck,
  onStartStudy,
}: {
  decks: readonly LibraryDeck[];
  dueCount: number;
  progress: ProgressData | null;
  setView: (view: View) => void;
  onSelectDeck: (deckId: string) => void;
  onStartStudy: () => void;
}) {
  const shown = decks.slice(0, 3);
  const estimate = Math.max(1, Math.ceil(dueCount * 0.6));
  const reviewedToday = progress?.days.at(-1)?.reviewedCards ?? 0;
  const dailyGoal = 20;
  const goalProgress = Math.min(
    100,
    Math.round((reviewedToday / dailyGoal) * 100),
  );
  return (
    <>
      <PageHeading
        title="Good morning."
        subtitle="A focused review now protects what you have already learned."
      />
      <section className="card home-hero relative overflow-hidden p-7 text-white shadow-float sm:p-9">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-white/10" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/70">
              TODAY’S LEARNING
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {dueCount === 0
                ? "You’re caught up"
                : `${dueCount} cards are ready`}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
              {dueCount === 0
                ? "Create new cards or revisit a deck while your queue is clear."
                : `Finish today’s queue in about ${estimate} minutes. Every answer is saved on this device first.`}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button onClick={onStartStudy} variant="inverted">
                Start review
              </Button>
              <Button variant="onDark" onClick={() => setView("create")}>
                Add cards
              </Button>
            </div>
          </div>
          <div
            className="grid size-32 place-items-center rounded-full p-3"
            style={{
              background: `conic-gradient(#ffffff ${goalProgress}%, rgb(255 255 255 / 18%) ${goalProgress}% 100%)`,
            }}
            role="img"
            aria-label={`${reviewedToday} of ${dailyGoal} daily goal cards reviewed`}
          >
            <div className="grid size-full place-items-center rounded-full bg-primary text-center">
              <span>
                <strong className="block text-2xl">{reviewedToday}</strong>
                <small className="text-[10px] text-white/70">
                  of {dailyGoal}
                </small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        {[
          [String(dueCount), "Due today", "Review queue"],
          [String(decks.length), "Active decks", "In your library"],
          [
            `${progress?.retentionPercent ?? 0}%`,
            "Retention",
            "Recent answers",
          ],
        ].map(([value, label, detail]) => (
          <div className="card p-5" key={label}>
            <strong className="text-2xl tracking-tight text-title">
              {value}
            </strong>
            <p className="mt-1 text-sm font-medium">{label}</p>
            <small className="text-xs text-muted">{detail}</small>
          </div>
        ))}
      </div>

      <div className="mb-5 mt-10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Continue learning</h2>
          <p className="mt-1 text-xs text-muted">
            Your most recent local decks
          </p>
        </div>
        <button
          onClick={() => setView("library")}
          className="text-sm font-semibold text-primary"
        >
          View library →
        </button>
      </div>
      <div className="grid grid-cols-3 gap-5 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {shown.map((deck, index) => {
          const dueShare = Math.min(
            100,
            Math.round((deck.dueCount / Math.max(1, deck.cardCount)) * 100),
          );
          const colors = ["bg-soft", "bg-[#e3f2e8]", "bg-[#f7edd4]"];
          return (
            <button
              key={deck.id}
              onClick={() => onSelectDeck(deck.id)}
              className="card surface-hover min-h-[170px] p-5 text-left"
            >
              <span
                className={`grid size-10 place-items-center rounded-xl text-sm font-bold text-primary ${colors[index % colors.length]}`}
              >
                {deck.name.slice(0, 1).toLocaleUpperCase()}
              </span>
              <strong className="mt-5 block text-base">{deck.name}</strong>
              <span className="mt-1 block text-xs text-muted">
                {deck.cardCount} cards • {deck.dueCount} due
              </span>
              <span className="mt-5 block h-1.5 overflow-hidden rounded-full bg-soft">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${dueShare}%` }}
                />
              </span>
            </button>
          );
        })}
        {shown.length === 0 && (
          <div className="card col-span-full p-8 text-center">
            <strong className="text-lg">Build your first learning deck</strong>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Add a topic, write a few cards, and Hafiza will schedule the rest.
            </p>
            <Button className="mt-5" onClick={() => setView("library")}>
              Create a deck
            </Button>
          </div>
        )}
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
  const [folderId, setFolderId] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "due" | "cards">("name");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const shown = [...decks]
    .filter(
      (deck) =>
        (!folderId || deck.folderId === folderId) &&
        deck.name
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((left, right) =>
      sort === "due"
        ? right.dueCount - left.dueCount
        : sort === "cards"
          ? right.cardCount - left.cardCount
          : left.name.localeCompare(right.name),
    );
  return (
    <>
      <PageHeading
        title="Library"
        subtitle={`${decks.length} decks organized for focused, offline learning.`}
        action={<Button onClick={() => setView("create")}>+ Create</Button>}
      />
      <section className="card mb-8 p-4 shadow-card sm:p-5">
        <form
          onSubmit={onAddDeck}
          className="grid items-end gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(150px,220px)_auto]"
        >
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
          <SelectField name="folderId" aria-label="Deck folder">
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </SelectField>
          <Button type="submit">Add</Button>
        </form>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setFolderId(null)}
          aria-pressed={folderId === null}
          className={`min-h-10 rounded-full px-4 text-xs font-semibold ${folderId === null ? "bg-primary text-white" : "border border-line bg-white"}`}
        >
          All decks
        </button>
        {folders.map((folder) => (
          <button
            className={`min-h-10 rounded-full px-4 text-xs font-semibold ${folderId === folder.id ? "bg-primary text-white" : "border border-line bg-white"}`}
            key={folder.id}
            onClick={() => setFolderId(folder.id)}
            aria-pressed={folderId === folder.id}
          >
            {folder.name} ·{" "}
            {decks.filter((deck) => deck.folderId === folder.id).length}
          </button>
        ))}
        <form
          onSubmit={onAddFolder}
          className="flex min-w-[240px] flex-1 gap-2 sm:max-w-[320px]"
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
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <input
          className="field"
          placeholder="Search decks…"
          aria-label="Search library"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <SelectField
          className="min-w-40"
          aria-label="Sort decks"
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as "name" | "due" | "cards")
          }
        >
          <option value="name">Sort: Name</option>
          <option value="due">Sort: Most due</option>
          <option value="cards">Sort: Most cards</option>
        </SelectField>
        <div className="flex rounded-xl border border-line bg-white p-1">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
            className={`min-h-9 rounded-lg px-3 text-xs ${layout === "grid" ? "bg-soft font-semibold text-primary" : "text-muted"}`}
          >
            Grid
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
            className={`min-h-9 rounded-lg px-3 text-xs ${layout === "list" ? "bg-soft font-semibold text-primary" : "text-muted"}`}
          >
            List
          </button>
        </div>
      </div>

      <div
        className={
          layout === "grid"
            ? "grid grid-cols-3 gap-5 max-xl:grid-cols-2 max-sm:grid-cols-1"
            : "grid gap-3"
        }
      >
        {shown.map((deck, index) => {
          const colors = [
            "bg-soft",
            "bg-[#e3f2e8]",
            "bg-[#f7edd4]",
            "bg-[#e5edfa]",
          ];
          const dueShare = Math.min(
            100,
            Math.round((deck.dueCount / Math.max(1, deck.cardCount)) * 100),
          );
          return (
            <button
              type="button"
              key={deck.id}
              onClick={() => onSelectDeck(deck.id)}
              className={`card surface-hover text-left ${layout === "grid" ? "min-h-[196px] p-5" : "flex min-h-[78px] items-center gap-4 px-5 py-3"}`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-primary ${colors[index % colors.length]}`}
              >
                {deck.name.slice(0, 1).toLocaleUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[15px]">
                  {deck.name}
                </strong>
                <small className="mt-1 block text-muted">
                  {deck.cardCount} cards · {deck.dueCount} due
                </small>
                {layout === "grid" && (
                  <span className="mt-8 block">
                    <span className="flex justify-between text-[10px] text-muted">
                      <span>Review workload</span>
                      <span>{dueShare}%</span>
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-soft">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${dueShare}%` }}
                      />
                    </span>
                  </span>
                )}
              </span>
              {layout === "list" && (
                <span aria-hidden="true" className="text-primary">
                  →
                </span>
              )}
            </button>
          );
        })}
        {shown.length === 0 && (
          <div className="card col-span-full p-10 text-center">
            <strong>No decks match this view</strong>
            <p className="mt-2 text-sm text-muted">
              Clear your search or choose another folder.
            </p>
          </div>
        )}
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
  const [filter, setFilter] = useState<"all" | "due" | "learning" | "review">(
    "all",
  );
  const filteredCards = cards.filter((card) => {
    if (filter === "all") return true;
    if (filter === "due") return card.dueAt <= new Date();
    return card.phase === filter;
  });
  const learning = cards.filter((card) =>
    ["learning", "relearning"].includes(card.phase),
  ).length;
  const mastered = Math.max(0, current.cardCount - current.dueCount - learning);
  return (
    <>
      <button
        className="mb-6 min-h-10 rounded-lg px-2 text-sm font-medium text-muted hover:bg-white"
        onClick={() => setView("library")}
      >
        ← Library
      </button>
      <PageHeading
        title={current.name}
        subtitle={`${current.cardCount} cards in your local collection.`}
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setView("create")}>
              + Add card
            </Button>
            <Button onClick={onStartStudy}>Start review</Button>
          </div>
        }
      />
      <div className="mb-8 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        {[
          [current.dueCount, "Due today"],
          [learning, "Learning"],
          [mastered, "Mastered"],
        ].map(([n, label]) => (
          <div className="card p-5" key={label}>
            <strong className="text-2xl tracking-tight">{n}</strong>
            <small className="mt-1 block text-xs text-muted">{label}</small>
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Cards</h2>
          <p className="mt-1 text-xs text-muted">
            Browse, search, or refine scheduling states.
          </p>
        </div>
        <input
          className="field w-full sm:max-w-[360px]"
          aria-label={`Search within ${current.name}`}
          placeholder={`Search within ${current.name}…`}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {[
          ["all", "All"],
          ["due", "Due"],
          ["learning", "Learning"],
          ["review", "Review"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() =>
              setFilter(value as "all" | "due" | "learning" | "review")
            }
            aria-pressed={filter === value}
            className={`min-h-10 rounded-full px-4 text-xs font-semibold ${filter === value ? "bg-primary text-white" : "border border-line bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {filteredCards.map((card) => (
          <div
            className="card surface-hover flex min-h-[86px] items-center justify-between gap-4 px-5 py-4 max-sm:items-start"
            key={card.id}
          >
            <span className="min-w-0">
              <strong className="block truncate text-sm">{card.front}</strong>
              <span className="mt-1 block truncate text-xs text-muted">
                {card.back}
              </span>
              <small className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-primary">
                {card.phase} · due {card.dueAt.toLocaleDateString()}
              </small>
            </span>
            <span className="flex shrink-0 gap-2">
              <button
                onClick={() => onEditCard(card)}
                className="min-h-10 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-soft"
              >
                Edit
              </button>
              <button
                onClick={() => onDeleteCard(card)}
                className="min-h-10 rounded-lg px-3 text-xs font-semibold text-red-700 hover:bg-[#fae3de]"
              >
                Delete
              </button>
            </span>
          </div>
        ))}
        {filteredCards.length === 0 && (
          <div className="card p-9 text-center">
            <strong>No cards found</strong>
            <p className="mt-2 text-sm text-muted">
              Try another filter or add a new card to this deck.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
function CardEditor({
  decks,
  selectedDeckId,
  setSelectedDeckId,
  card,
  onSave,
  setView,
}: {
  decks: readonly LibraryDeck[];
  selectedDeckId: string;
  setSelectedDeckId: (id: string) => void;
  card: LibraryCard | null;
  onSave: (input: {
    front: string;
    back: string;
    deckId: string;
  }) => Promise<void>;
  setView: (view: View) => void;
}) {
  const initialFront = card?.front ?? "";
  const initialBack = card?.back ?? "";
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const deckId = card?.deckId ?? selectedDeckId;
  const dirty = front !== initialFront || back !== initialBack;
  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [dirty]);
  return (
    <>
      <PageHeading
        title={card ? "Edit card" : "Create cards"}
        subtitle={
          card
            ? "Refine this card using the same focused editor."
            : "Turn your material into clear, reviewable knowledge."
        }
        action={
          card ? (
            <Button variant="secondary" onClick={() => setView("deck")}>
              Cancel
            </Button>
          ) : undefined
        }
      />
      {!card && (
        <>
          <p className="mb-3 text-sm">Create with</p>
          <div className="mb-7 flex gap-4">
            <Button>Manual</Button>
            <Button variant="secondary" onClick={() => setView("import")}>
              Import
            </Button>
          </div>
        </>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ front, back, deckId });
        }}
        className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 max-xl:grid-cols-1"
      >
        <div className="card p-5 shadow-card sm:p-7">
          <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
            <div>
              <strong className="text-sm">Basic card</strong>
              <p className="mt-1 text-xs text-muted">
                Prompt on the front, recall on the back.
              </p>
            </div>
            <span className="rounded-full bg-soft px-3 py-1 text-[10px] font-semibold text-primary">
              {card ? "SAVED LOCALLY" : "LOCAL DRAFT"}
            </span>
          </div>
          <label className="label" htmlFor="card-front">
            Question
          </label>
          <textarea
            id="card-front"
            name="front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            maxLength={10_000}
            className="field min-h-[110px] resize-none"
            placeholder="Type the question or prompt…"
            required
          />
          <p className="mt-2 text-right text-[10px] text-muted">
            {front.length} / 10,000
          </p>
          <label className="label mt-5" htmlFor="card-back">
            Answer
          </label>
          <textarea
            id="card-back"
            name="back"
            value={back}
            onChange={(event) => setBack(event.target.value)}
            maxLength={10_000}
            className="field min-h-[140px] resize-none"
            placeholder="Write the answer…"
            required
          />
          <p className="mt-2 text-right text-[10px] text-muted">
            {back.length} / 10,000
          </p>
          <label className="label mt-5" htmlFor="card-deck">
            Deck
          </label>
          <SelectField
            id="card-deck"
            name="deckId"
            value={deckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            disabled={card !== null}
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
          </SelectField>
        </div>
        <div className="xl:sticky xl:top-8 xl:self-start">
          <div className="card min-h-[300px] p-6 shadow-card">
            <p className="eyebrow">PREVIEW</p>
            <strong className="mt-8 block text-lg leading-7">
              {front || "Which nerve innervates…"}
            </strong>
            <hr className="my-8 border-line" />
            <p className="text-sm leading-6 text-muted">
              {back || "Your answer preview appears here."}
            </p>
          </div>
          <p className="my-5 text-xs text-muted">
            {card
              ? "Changes are saved locally first."
              : "Preview before saving."}
          </p>
          <Button
            type="submit"
            disabled={!decks.length}
            className="w-full sm:w-auto"
          >
            {card ? "Save changes" : "Save card"}
          </Button>
        </div>
      </form>
    </>
  );
}
function Progress({
  data,
  dueCount,
  deckCount,
}: {
  data: ProgressData | null;
  dueCount: number;
  deckCount: number;
}) {
  const recent = data?.days.slice(-7) ?? [];
  const activity = data?.days.slice(-28) ?? [];
  const max = Math.max(1, ...recent.map((day) => day.reviewedCards));
  const bars = Array.from({ length: 7 }, (_, index) => {
    const day = recent[index];
    return day ? Math.max(8, Math.round((day.reviewedCards / max) * 140)) : 8;
  });
  const studyMinutes = Math.round((data?.studyTimeMs ?? 0) / 60_000);
  return (
    <>
      <PageHeading
        title="Progress"
        subtitle="Understand your consistency and make the next study decision quickly."
      />
      <div className="mb-8 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {[
          [`${data?.retentionPercent ?? 0}%`, "Retention"],
          [String(data?.reviewedCards ?? 0), "Cards reviewed"],
          [
            `${Math.floor(studyMinutes / 60)}h ${studyMinutes % 60}m`,
            "Study time",
          ],
          [String(dueCount), "Due now"],
        ].map(([v, l]) => (
          <div className="card p-5" key={l}>
            <strong className="text-2xl tracking-tight">{v}</strong>
            <small className="mt-2 block text-xs text-muted">{l}</small>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)] gap-6 max-xl:grid-cols-1">
        <div className="card min-h-[310px] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-sm">Study activity</strong>
              <p className="mt-1 text-xs text-muted">
                Cards reviewed this week
              </p>
            </div>
            <span className="rounded-full bg-soft px-3 py-1 text-[10px] font-semibold text-primary">
              7 DAYS
            </span>
          </div>
          <div className="mt-8 flex h-48 items-end justify-around gap-3">
            {bars.map((height, i) => (
              <div
                className="flex h-full flex-1 flex-col justify-end text-center"
                key={i}
              >
                <span
                  className="mx-auto w-full max-w-[42px] rounded-t-lg bg-primary/75"
                  style={{ height }}
                  title={`${recent[i]?.reviewedCards ?? 0} cards`}
                />
                <small className="mt-3 text-muted">{"MTWTFSS"[i]}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card min-h-[310px] p-6">
          <p className="eyebrow">NEXT BEST ACTION</p>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            {dueCount > 0
              ? `Review ${dueCount} due cards`
              : "Keep your queue clear"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {data && data.retentionPercent >= 80
              ? "Your recent retention is strong. Keep sessions short and consistent."
              : "Use honest ratings and repeat difficult cards to strengthen recall."}
          </p>
          <div className="mt-8 rounded-xl bg-soft p-4">
            <strong className="text-sm">{deckCount} active decks</strong>
            <p className="mt-1 text-xs text-muted">
              Progress is calculated from local review events only.
            </p>
          </div>
        </div>
      </div>
      <section className="card mt-6 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Four-week consistency</h2>
            <p className="mt-1 text-xs text-muted">
              Darker squares represent more completed reviews.
            </p>
          </div>
          <span className="text-xs text-muted">Last 28 days</span>
        </div>
        <div className="mt-6 grid grid-cols-14 gap-2 max-sm:grid-cols-7">
          {Array.from({ length: 28 }, (_, index) => {
            const day = activity[index];
            const intensity = day
              ? Math.min(4, Math.ceil(day.reviewedCards / Math.max(1, max / 4)))
              : 0;
            const color = [
              "bg-soft",
              "bg-[#dcd7f4]",
              "bg-[#b8afe5]",
              "bg-[#766bc0]",
              "bg-primary",
            ][intensity];
            return (
              <span
                key={day?.date ?? index}
                className={`aspect-square rounded-md ${color}`}
                title={
                  day
                    ? `${day.date}: ${day.reviewedCards} reviews`
                    : "No reviews"
                }
              />
            );
          })}
        </div>
      </section>
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
    return (
      <div className="grid min-h-[70vh] place-items-center p-6">
        <p role="status" className="animate-pulse text-sm text-muted">
          Preparing your local study queue…
        </p>
      </div>
    );
  if (complete)
    return (
      <div className="mx-auto max-w-[720px] px-4 py-12 text-center sm:py-16">
        <div className="card min-h-[500px] p-7 shadow-float sm:p-12">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#e3f2e8] text-2xl text-success">
            ✓
          </div>
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1 className="mt-6 text-3xl font-semibold">Nice work</h1>
          <p className="mt-2 text-muted">
            You finished today’s planned review.
          </p>
          <div className="my-10 grid grid-cols-3 gap-4 text-left max-sm:grid-cols-1">
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
          <div className="flex justify-center gap-4 max-sm:flex-col">
            <Button onClick={() => setView("today")}>Done</Button>
            <Button variant="secondary" onClick={() => setView("progress")}>
              View progress
            </Button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="min-h-screen px-4 py-6 pb-28 sm:px-7 md:px-10 md:py-9">
      <div className="mx-auto flex max-w-[980px] items-center justify-between text-sm">
        <button
          onClick={() => setView("today")}
          className="min-h-10 rounded-lg px-3 font-medium text-muted hover:bg-white"
        >
          ← Exit session
        </button>
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted">
          {Math.max(0, state.total - state.current + 1)} remaining
        </span>
      </div>
      <div
        className="mx-auto mt-5 h-1.5 max-w-[980px] overflow-hidden rounded bg-soft"
        role="progressbar"
        aria-label="Study session progress"
        aria-valuemin={0}
        aria-valuemax={state.total}
        aria-valuenow={state.current}
      >
        <div
          className="h-full bg-primary"
          style={{
            width: `${state.total === 0 ? 100 : (state.current / state.total) * 100}%`,
          }}
        />
      </div>
      <section
        aria-live="polite"
        className={`card mx-auto mt-8 max-w-[860px] p-6 shadow-float sm:mt-12 sm:p-10 ${revealed ? "min-h-[460px]" : "min-h-[420px]"}`}
      >
        <div className="flex items-center justify-between">
          <p className="eyebrow">QUESTION</p>
          <span className="text-xs text-muted">
            {state.current} of {state.total}
          </span>
        </div>
        <h1
          className={`${revealed ? "mt-8 text-xl" : "mx-auto mt-20 max-w-[660px] text-2xl sm:mt-24 sm:text-3xl"} font-semibold leading-relaxed tracking-[-0.02em]`}
        >
          {state.card?.front}
        </h1>
        {revealed ? (
          <>
            <hr className="my-7 border-line" />
            <p className="eyebrow">ANSWER</p>
            <h2 className="mt-7 text-xl font-semibold leading-relaxed sm:ml-8 sm:text-2xl">
              {state.card?.back}
            </h2>
          </>
        ) : (
          <div className="mt-24 text-center">
            <Button
              variant="secondary"
              disabled={busy || state.itemId === null}
              onClick={reveal}
            >
              Show answer
            </Button>
          </div>
        )}
      </section>
      {revealed ? (
        <div className="mx-auto mt-7 max-w-[820px] text-center">
          <p className="mb-4 text-sm font-medium">How well did you remember?</p>
          <div className="grid grid-cols-4 gap-3 sm:gap-5 max-sm:grid-cols-2">
            {[
              ["Again", "10 min", "bg-[#fae3de]"],
              ["Hard", "1 day", "bg-[#f7edd4]"],
              ["Good", "4 days", "bg-[#e3f2e8]"],
              ["Easy", "10 days", "bg-[#e5edfa]"],
            ].map(([r, t, color], index) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => {
                  const ratings = ["again", "hard", "good", "easy"] as const;
                  rate(ratings[index]!);
                }}
                className={`${color} min-h-[68px] rounded-xl border border-transparent px-4 py-3 text-left transition hover:-translate-y-px hover:border-primary/20 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50`}
              >
                <strong className="text-[13px]">{r}</strong>
                <small className="mt-1 block text-[11px] text-muted">{t}</small>
              </button>
            ))}
          </div>
          <p className="mt-4 hidden text-[10px] text-muted sm:block">
            Keyboard shortcuts: 1 Again · 2 Hard · 3 Good · 4 Easy
          </p>
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
  const [error, setError] = useState("");
  async function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    try {
      setPreview(
        file.name.toLocaleLowerCase().endsWith(".xlsx")
          ? await application.previewXlsx(file.name, await file.arrayBuffer())
          : await application.previewCsv(file.name, await file.text()),
      );
    } catch (reason: unknown) {
      setPreview(null);
      setError(failureMessage(reason, "The selected file could not be read."));
    }
  }
  return (
    <>
      <PageHeading
        title="Import cards"
        subtitle="Analyze files locally, review every issue, then choose what to save."
      />
      <div className="mb-7 grid grid-cols-5 gap-2 rounded-xl border border-line bg-white p-2 text-center text-[10px] font-semibold text-muted max-sm:grid-cols-3">
        <span className="rounded-lg bg-soft px-2 py-2 text-primary">
          1 Select
        </span>
        <span
          className={
            preview ? "rounded-lg bg-soft px-2 py-2 text-primary" : "px-2 py-2"
          }
        >
          2 Analyze
        </span>
        <span
          className={
            preview ? "rounded-lg bg-soft px-2 py-2 text-primary" : "px-2 py-2"
          }
        >
          3 Preview
        </span>
        <span
          className={
            preview?.cards.length
              ? "rounded-lg bg-soft px-2 py-2 text-primary"
              : "px-2 py-2"
          }
        >
          4 Confirm
        </span>
        <span
          className={
            message
              ? "rounded-lg bg-[#e3f2e8] px-2 py-2 text-success"
              : "px-2 py-2"
          }
        >
          5 Import
        </span>
      </div>
      <div className="grid grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] gap-6 max-xl:grid-cols-1">
        <section className="card min-h-[430px] p-6 shadow-card">
          <label className="label" htmlFor="csv-file">
            CSV or XLSX file
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
          <SelectField
            id="import-deck"
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
          >
            <option value="">Choose a deck</option>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </SelectField>
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
        <section className="card min-h-[430px] p-6 shadow-card">
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
                  })
                  .catch((reason: unknown) => {
                    setError(
                      failureMessage(
                        reason,
                        "The import could not be completed.",
                      ),
                    );
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
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {error}
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
  const [error, setError] = useState("");
  const [restoreSource, setRestoreSource] = useState<"local" | "drive" | null>(
    null,
  );
  async function downloadBackup() {
    setError("");
    try {
      const compressed = await application.exportBackupFile();
      const url = URL.createObjectURL(
        new Blob([compressed], { type: "application/gzip" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `hafiza-${new Date().toISOString().slice(0, 10)}.hafiza`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setError(failureMessage(reason, "The backup could not be exported."));
    }
  }
  async function inspect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const text = await application.decodeBackupFile(await file.arrayBuffer());
      const info = application.inspectBackup(text);
      setRestoreText(text);
      setSummary(
        `${info.deckCount} decks and ${info.cardCount} cards • ${new Date(info.exportedAt).toLocaleString()}`,
      );
    } catch (reason: unknown) {
      setRestoreText(null);
      setSummary("");
      setError(
        failureMessage(
          reason,
          "This backup is corrupt or uses an unsupported format.",
        ),
      );
    }
  }
  async function confirmRestore() {
    const source = restoreSource;
    setRestoreSource(null);
    setError("");
    try {
      if (source === "local" && restoreText) {
        await application.restoreBackup(restoreText);
      } else if (source === "drive") {
        setDriveStatus("Downloading…");
        await application.restoreFromDrive();
        setDriveStatus("Drive backup restored.");
      } else {
        return;
      }
      await onRestored();
      setSummary("");
      setRestoreText(null);
    } catch (reason: unknown) {
      setError(
        failureMessage(
          reason,
          "Restore was interrupted. Your previous local data was preserved.",
        ),
      );
    }
  }
  return (
    <>
      <PageHeading
        title="Settings"
        subtitle="Your data stays on this device unless you export it."
      />
      <div className="grid max-w-[900px] gap-5">
        <section className="card grid gap-5 p-6 shadow-card sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="font-semibold">Local backup</h2>
            <p className="my-3 text-sm text-muted">
              Export a versioned .hafiza recovery file containing decks, cards,
              review history, and settings.
            </p>
          </div>
          <Button onClick={() => void downloadBackup()}>Export backup</Button>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Restore backup</h2>
          <p className="my-3 text-sm text-muted">
            The backup is validated and previewed before replacing local data.
          </p>
          <label className="label" htmlFor="restore-file">
            Choose a Hafiza backup
          </label>
          <input
            id="restore-file"
            type="file"
            accept=".hafiza,application/json"
            onChange={(event) => void inspect(event)}
            className="field"
          />
          {summary && (
            <div className="mt-4">
              <p className="mb-3 text-sm">{summary}</p>
              <Button
                variant="secondary"
                onClick={() => setRestoreSource("local")}
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
                      failureMessage(error, "Drive backup failed."),
                    ),
                );
              }}
            >
              Backup to Drive
            </Button>
            <Button
              variant="secondary"
              disabled={!application.driveEnabled()}
              onClick={() => setRestoreSource("drive")}
            >
              Restore from Drive
            </Button>
            <Button
              variant="secondary"
              disabled={!application.driveEnabled()}
              onClick={() => {
                setDriveStatus("Syncing local changes…");
                void application.syncNow().then(
                  ({ pushed, pulled }) =>
                    setDriveStatus(
                      `Sync complete: ${pushed} pushed, ${pulled} applied.`,
                    ),
                  (error: unknown) =>
                    setDriveStatus(failureMessage(error, "Sync failed.")),
                );
              }}
            >
              Sync now
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                application.disconnectDrive();
                setDriveStatus("Google Drive disconnected.");
              }}
            >
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
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      {restoreSource && (
        <ConfirmDialog
          title="Replace local learning data?"
          description="Hafiza validates the backup first and restores it in one transaction. Keep a current export before continuing."
          confirmLabel="Restore backup"
          danger
          onCancel={() => setRestoreSource(null)}
          onConfirm={() => void confirmRestore()}
        />
      )}
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
  const [editingCard, setEditingCard] = useState<LibraryCard | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<LibraryCard | null>(
    null,
  );
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [status, setStatus] = useState("Loading your local library…");
  const [syncStatus, setSyncStatus] = useState<SyncStatusData>({
    phase: "idle",
    message: "Local data is up to date",
    lastSyncedAt: null,
  });
  const [view, setView] = useState<View>("today");
  const refresh = useCallback(async () => {
    await measureOperation("hafiza.startup", async () => {
      try {
        const [next, nextFolders, nextProgress] = await Promise.all([
          application.loadLibrary(),
          application.loadFolders(),
          application.loadProgress(),
        ]);
        setDecks(next);
        setFolders(nextFolders);
        setProgress(nextProgress);
        setSelectedDeckId((v) => v || next[0]?.id || "");
        setStatus(
          next.length
            ? "Saved on this device"
            : "Create your first deck to begin.",
        );
      } catch (error: unknown) {
        setStatus(
          failureMessage(error, "The local library could not be opened."),
        );
      }
    });
  }, [application]);
  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);
  useEffect(
    () => application.subscribeSyncStatus(setSyncStatus),
    [application],
  );
  useEffect(() => {
    if (!application.driveEnabled()) return;
    const syncOnline = () => {
      void application.syncIfConnected().catch(() => undefined);
    };
    window.addEventListener("online", syncOnline);
    return () => window.removeEventListener("online", syncOnline);
  }, [application]);
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
      setStatus(failureMessage(error, "The deck could not be created."));
    }
  }
  async function addFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    try {
      await application.createFolder(formText(new FormData(el), "folderName"));
      el.reset();
      await refresh();
    } catch (error: unknown) {
      setStatus(failureMessage(error, "The folder could not be created."));
    }
  }
  async function saveCard(input: {
    front: string;
    back: string;
    deckId: string;
  }) {
    try {
      if (editingCard) {
        await application.editCard(editingCard.id, input.front, input.back);
      } else {
        await application.createCard(input.deckId, input.front, input.back);
      }
      await refresh();
      setCards(await application.loadCards(input.deckId, cardSearch));
      setEditingCard(null);
      setSelectedDeckId(input.deckId);
      setView("deck");
    } catch (error: unknown) {
      setStatus(failureMessage(error, "The card could not be saved."));
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
      setStatus(failureMessage(error, "The study session could not start."));
    }
  }
  function editCard(card: LibraryCard) {
    setEditingCard(card);
    setSelectedDeckId(card.deckId);
    setView("edit");
  }
  async function deleteCard(card: LibraryCard) {
    try {
      await application.deleteCard(card.id);
      setCards(await application.loadCards(card.deckId, cardSearch));
      await refresh();
      setStatus("Card moved to the recovery state.");
    } catch (error: unknown) {
      setStatus(failureMessage(error, "The card could not be deleted."));
    } finally {
      setDeleteCandidate(null);
    }
  }
  const dueCount = useMemo(
    () => decks.reduce((sum, d) => sum + d.dueCount, 0),
    [decks],
  );
  const selected = decks.find((d) => d.id === selectedDeckId);
  const statusIsError = /could not|out of storage|failed|unavailable/i.test(
    status,
  );
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar view={view} setView={setView} syncStatus={syncStatus} />
      <main
        id="main-content"
        tabIndex={-1}
        className={`${view === "study" ? "p-0 md:ml-[88px] lg:ml-[248px]" : "max-w-[1240px] px-4 py-7 pb-24 sm:px-7 md:ml-[88px] md:px-10 md:py-10 lg:ml-[248px] lg:px-12"} min-h-screen`}
      >
        <span role="status" className="sr-only">
          {status}
        </span>
        {statusIsError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-[#fae3de] px-4 py-3 text-sm text-red-800"
          >
            {status}
          </div>
        )}
        {view === "today" && (
          <Today
            decks={decks}
            dueCount={dueCount}
            progress={progress}
            setView={setView}
            onSelectDeck={selectDeck}
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
            onEditCard={editCard}
            onDeleteCard={setDeleteCandidate}
          />
        )}{" "}
        {(view === "create" || view === "edit") && (
          <CardEditor
            decks={decks}
            selectedDeckId={selectedDeckId}
            setSelectedDeckId={setSelectedDeckId}
            card={view === "edit" ? editingCard : null}
            onSave={saveCard}
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
        {view === "progress" && (
          <Progress
            data={progress}
            dueCount={dueCount}
            deckCount={decks.length}
          />
        )}{" "}
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
      {deleteCandidate && (
        <ConfirmDialog
          title="Move this card to recovery?"
          description="The card will disappear from this deck but its tombstone remains available for backup and synchronization safety."
          confirmLabel="Delete card"
          danger
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => void deleteCard(deleteCandidate)}
        />
      )}
    </div>
  );
}
