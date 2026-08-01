-- §8.3 revisi 2026-08-01: baris pra-login yang user pilih "jangan sync"
-- ditandai di sini, supaya push (baik initial pull-push maupun "Sync Now"
-- manual belakangan) melewatinya selamanya sampai user mengubah sendiri.
ALTER TABLE sync_meta ADD COLUMN excluded_from_sync INTEGER NOT NULL DEFAULT 0;
