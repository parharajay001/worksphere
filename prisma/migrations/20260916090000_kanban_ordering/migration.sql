ALTER TABLE "Project" ADD COLUMN "boardRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "projectId", "status" ORDER BY "createdAt", "id"
  ) - 1 AS position FROM "Task"
)
UPDATE "Task" SET "position" = ranked.position FROM ranked WHERE "Task"."id" = ranked."id";

ALTER TABLE "Task" ADD CONSTRAINT "Task_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "Project" ADD CONSTRAINT "Project_boardRevision_nonnegative" CHECK ("boardRevision" >= 0);
CREATE INDEX "Task_projectId_status_position_idx" ON "Task"("projectId", "status", "position");
