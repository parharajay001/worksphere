import "server-only";
import { AppError } from "../../lib/api/errors.ts";
import type { HealthRepository } from "./health.repository.ts";
import type { HealthQuery } from "./health.schema.ts";

export function createHealthService(repository: HealthRepository) {
  return async (query: HealthQuery) => {
    if (query.check === "database") {
      try {
        await repository.checkDatabase();
      } catch (error) {
        throw new AppError("SERVICE_UNAVAILABLE", { cause: error });
      }
    }
    return {
      status: "ok" as const,
      service: "worksphere",
      timestamp: new Date().toISOString(),
      ...(query.check === "database"
        ? { checks: { database: "ok" as const } }
        : {}),
    };
  };
}
