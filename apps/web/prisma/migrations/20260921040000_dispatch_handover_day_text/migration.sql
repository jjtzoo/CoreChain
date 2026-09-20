-- The handover day travels as YYYY-MM-DD text, like drillholes.started_at and
-- completed_at, and the upload rules cast it that way. As a DATE column it
-- refused every handover the phone sent. Existing values keep their day.
ALTER TABLE "dispatches"
  ALTER COLUMN "handover_at" TYPE TEXT USING to_char("handover_at", 'YYYY-MM-DD');
