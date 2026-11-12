/**
 * Birch Q&A Squirrel: the same character as the Friday pipeline squirrel
 * (fridayapp.org/share/align-pipeline). Art is copied from
 * randy-ship-it/friday-crm artifacts/crm/public/brand/ so this site has no
 * runtime dependency on Friday.
 *
 * TODO(friday-unify): when Friday exposes a public squirrel endpoint, set
 * FRIDAY_SQUIRREL.askEndpoint (e.g. "https://fridayapp.org/api/squirrel/pipeline-ask"
 * with pipe "birch") and let randy-chat fall back to /api/launch/randy-chat.
 * No data is wired today: askEndpoint stays null on purpose.
 */
export const BIRCH_SQUIRREL = {
  name: "Birch Q&A Squirrel",
  /** 96px head-and-acorn icon, identical to Friday's /brand/squirrel-96.webp. */
  iconSrc: "/brand/squirrel-96.webp",
  /** 720px full-body art, identical to Friday's /brand/friday-squirrel.webp. */
  fullSrc: "/brand/friday-squirrel.webp",
  /** Source of truth for the character art and motion. */
  sourceRepo: "randy-ship-it/friday-crm",
} as const;

export const FRIDAY_SQUIRREL = {
  /** Pipe key Friday's widget uses for Birch ("Scale ad credits" on Friday share pages). */
  pipe: "birch",
  /** TODO(friday-unify): Friday ask endpoint. null = use Birch's own chat backend. */
  askEndpoint: null as string | null,
} as const;
