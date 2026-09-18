import { NONCE_SCHEMA, sqlLedger } from "./nonce-ledger";
import { installNonceLedger } from "./x402";

let attached = false;
let attaching: Promise<void> | null = null;

/**
 * SQL ledger only when DATABASE_URL is set (Neon). Sinon mémoire — pas
 * d'import de db.ts, pour ne pas tuer le preview production sans Neon.
 * Si Neon est configuré mais injoignable, on relance au prochain appel
 * (pas de repli mémoire silencieux : ça autoriserait un double settle).
 */
export async function ensureSqlLedger() {
  if (attached) return;
  if (attaching) return attaching;
  attaching = (async () => {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      attached = true;
      return;
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(NONCE_SCHEMA);
    installNonceLedger(sqlLedger(sql));
    attached = true;
  })().finally(() => {
    attaching = null;
  });
  return attaching;
}
