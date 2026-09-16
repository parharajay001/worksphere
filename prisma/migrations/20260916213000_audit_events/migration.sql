CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "actorId" UUID,
  "action" VARCHAR(80) NOT NULL,
  "targetType" VARCHAR(60) NOT NULL,
  "targetId" VARCHAR(255),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_tenantId_createdAt_id_idx" ON "AuditEvent"("tenantId", "createdAt", "id");
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

CREATE FUNCTION reject_audit_event_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent rows are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditEvent_immutable_update" BEFORE UPDATE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_changes();
CREATE TRIGGER "AuditEvent_immutable_delete" BEFORE DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_changes();
