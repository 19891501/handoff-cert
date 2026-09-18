-- Ledger x402 : un nonce EIP-3009 ne se dépense qu'une fois.
-- Lignes non possédées (pas de user_id) : le settle est public.
-- Colonne tx_hash (pas "transaction") : mot réservé Postgres.
create table if not exists x402_nonces (
  network    text not null,
  payer      text not null,
  nonce      text not null,
  asset      text not null default '',
  tx_hash    text not null default '',
  settled_at timestamptz not null default now(),
  primary key (network, payer, nonce)
);
