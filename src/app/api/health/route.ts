export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Liveness only. Dependency readiness belongs with the database/infrastructure.
export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "worksphere",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
