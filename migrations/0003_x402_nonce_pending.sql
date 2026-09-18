-- Empty tx_hash = pending (in-flight settle). Non-empty = settled. First-wins.
alter table x402_nonces
  alter column tx_hash set default '';
