import type { PrismaClient } from "../src/generated/prisma/client.ts";

// No working credentials, provider accounts, or session tokens are seeded.
export async function seedDevelopmentData(database: PrismaClient) {
  return database.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      where: { slug: "worksphere-demo" },
      create: { name: "WorkSphere Demo", slug: "worksphere-demo" },
      update: {},
    });

    const users = [
      { email: "owner@worksphere.example", name: "Demo Owner", role: "OWNER" },
      {
        email: "manager@worksphere.example",
        name: "Demo Manager",
        role: "MANAGER",
      },
      {
        email: "member@worksphere.example",
        name: "Demo Member",
        role: "MEMBER",
      },
    ] as const;

    for (const { email, name, role } of users) {
      const user = await transaction.user.upsert({
        where: { email },
        create: { email, name },
        update: {},
      });
      await transaction.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        create: { organizationId: organization.id, userId: user.id, role },
        update: {},
      });
    }

    return { organization: organization.slug, users: users.length };
  });
}
