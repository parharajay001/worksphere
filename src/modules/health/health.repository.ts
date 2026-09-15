import "server-only";

export type HealthRepository = { checkDatabase: () => Promise<void> };

export const healthRepository: HealthRepository = {
  async checkDatabase() {
    // Import lazily: liveness must work without a database connection.
    const { database } = await import("../../database/client.ts");
    const rows = await database.$queryRaw<
      Array<{ ready: number }>
    >`SELECT 1 AS ready`;
    if (rows[0]?.ready !== 1)
      throw new Error("Database probe returned an unexpected result");
  },
};
