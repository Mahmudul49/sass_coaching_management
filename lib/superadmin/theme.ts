import "server-only";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/connect";
import { Collections, type ThemeDoc, type ThemePalette } from "@/lib/db/collections";
import { DEFAULT_CONSOLE_THEME, THEME_TOKENS } from "@/lib/theme/console";
import { requireSuperAdmin } from "@/lib/auth/guards";

export type ConsoleTheme = { light: ThemePalette; dark: ThemePalette };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Coerce arbitrary input to a valid palette, falling back to defaults per token. */
function sanitize(input: unknown, fallback: ThemePalette): ThemePalette {
  const src = (input ?? {}) as Record<string, unknown>;
  const out = { ...fallback };
  for (const { key } of THEME_TOKENS) {
    const v = src[key];
    if (typeof v === "string" && HEX_RE.test(v)) out[key] = v;
  }
  return out;
}

/** Read the global console theme (or defaults when unset). Safe for any console role. */
export async function getConsoleTheme(): Promise<ConsoleTheme> {
  const db = await getDb();
  const doc = await db
    .collection<ThemeDoc>(Collections.themeSettings)
    .findOne({ scope: "console" });
  if (!doc) return DEFAULT_CONSOLE_THEME;
  return {
    light: sanitize(doc.light, DEFAULT_CONSOLE_THEME.light),
    dark: sanitize(doc.dark, DEFAULT_CONSOLE_THEME.dark),
  };
}

/** Persist the console theme (SuperAdmin only) and revalidate the console. */
export async function saveConsoleTheme(
  input: ConsoleTheme
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();

  const light = sanitize(input?.light, DEFAULT_CONSOLE_THEME.light);
  const dark = sanitize(input?.dark, DEFAULT_CONSOLE_THEME.dark);

  const db = await getDb();
  await db.collection<ThemeDoc>(Collections.themeSettings).updateOne(
    { scope: "console" },
    { $set: { light, dark, updatedAt: new Date() }, $setOnInsert: { scope: "console" } },
    { upsert: true }
  );

  // Re-render the whole console subtree so the new theme applies immediately.
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
