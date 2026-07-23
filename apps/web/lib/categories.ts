// Photo category keys + Hebrew labels — the web-side source of truth, mirroring
// the API's CATEGORY_KEYS (apps/api/src/index.ts) and the DB category CHECK
// constraint (migration 0012). The gallery festive chips and the photographer
// dashboard correction menu both read from here. When the founder reconciles
// 7 -> 4 categories, update this list together with the API constant, the
// migration, and the gallery chips.
export type PhotoCategory =
  | "ceremony"
  | "couple"
  | "dances"
  | "reception"
  | "main_course"
  | "family"
  | "venue";

export const PHOTO_CATEGORIES: { key: PhotoCategory; label: string }[] = [
  { key: "ceremony", label: "חופה" },
  { key: "couple", label: "הזוג" },
  { key: "family", label: "משפחה" },
  { key: "dances", label: "ריקודים" },
  { key: "reception", label: "קבלת פנים" },
  { key: "main_course", label: "מנה עיקרית" },
  { key: "venue", label: "אולם" },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PHOTO_CATEGORIES.map((c) => [c.key, c.label]),
);
