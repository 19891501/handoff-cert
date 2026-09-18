export const NONCE_TABLE = "x402_nonces";

export const NONCE_SCHEMA = `
create table if not exists x402_nonces (
  network    text not null,
  payer      text not null,
  nonce      text not null,
  asset      text not null default '',
  tx_hash    text not null default '',
  settled_at timestamptz not null default now(),
  primary key (network, payer, nonce)
)`;

export interface NonceRow {
  transaction: string;
  asset: string;
}

export interface NonceLedger {
  readonly backend: "memory" | "sql";
  get(network: string, payer: string, nonce: string): Promise<NonceRow | null>;
  put(
    network: string,
    payer: string,
    nonce: string,
    asset: string,
    transaction: string,
  ): Promise<NonceRow>;
  del(network: string, payer: string, nonce: string): Promise<void>;
}

function norm(network: string, payer: string, nonce: string) {
  return {
    network,
    payer: payer.toLowerCase(),
    nonce: nonce.toLowerCase(),
  };
}

function asRow(
  raw: { transaction?: string; tx_hash?: string; asset?: string } | undefined,
  fallback?: NonceRow,
): NonceRow | null {
  if (!raw) return fallback ?? null;
  return {
    transaction: raw.transaction || raw.tx_hash || fallback?.transaction || "",
    asset: raw.asset || fallback?.asset || "",
  };
}

export function memoryLedger(): NonceLedger {
  const rows = new Map<string, NonceRow>();
  const id = (network: string, payer: string, nonce: string) => {
    const n = norm(network, payer, nonce);
    return `${n.network}:${n.payer}:${n.nonce}`;
  };
  return {
    backend: "memory",
    async get(network, payer, nonce) {
      return rows.get(id(network, payer, nonce)) ?? null;
    },
    async put(network, payer, nonce, asset, transaction) {
      const key = id(network, payer, nonce);
      const existing = rows.get(key);
      if (existing?.transaction) return existing;
      const row = { transaction, asset };
      rows.set(key, row);
      return row;
    },
    async del(network, payer, nonce) {
      rows.delete(id(network, payer, nonce));
    },
  };
}

export interface SqlLike {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export function sqlLedger(sql: SqlLike): NonceLedger {
  return {
    backend: "sql",
    async get(network, payer, nonce) {
      const n = norm(network, payer, nonce);
      const rows = await sql.query<{ transaction?: string; tx_hash?: string; asset: string }>(
        "select tx_hash as transaction, asset from x402_nonces where network = $1 and payer = $2 and nonce = $3",
        [n.network, n.payer, n.nonce],
      );
      return asRow(rows[0]);
    },
    async put(network, payer, nonce, asset, transaction) {
      const n = norm(network, payer, nonce);
      const inserted = await sql.query<{
        transaction?: string;
        tx_hash?: string;
        asset: string;
      }>(
        `insert into x402_nonces (network, payer, nonce, asset, tx_hash)
         values ($1, $2, $3, $4, $5)
         on conflict (network, payer, nonce) do nothing
         returning tx_hash as transaction, asset`,
        [n.network, n.payer, n.nonce, asset.toLowerCase(), transaction],
      );
      if (inserted[0]) return asRow(inserted[0], { transaction, asset })!;
      const existing = await sql.query<{
        transaction?: string;
        tx_hash?: string;
        asset: string;
      }>(
        "select tx_hash as transaction, asset from x402_nonces where network = $1 and payer = $2 and nonce = $3",
        [n.network, n.payer, n.nonce],
      );
      return asRow(existing[0], { transaction, asset })!;
    },
    async del(network, payer, nonce) {
      const n = norm(network, payer, nonce);
      await sql.query(
        "delete from x402_nonces where network = $1 and payer = $2 and nonce = $3",
        [n.network, n.payer, n.nonce],
      );
    },
  };
}
