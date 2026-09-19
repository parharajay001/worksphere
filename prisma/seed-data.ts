import type { PrismaClient } from "../src/generated/prisma/client.ts";

const DEMO_PASSWORD_HASH =
  "scrypt$d29ya3NwaGVyZS1kZW1vIQ$er_C2QCF6I55xv2czhtbmWVcaBztPKnXdyywSoLbTb72xdrU9XV64ihXNW9oVEB_xklHNlxQAssNVeueNY18Uw";

const ids = {
  teams: {
    product: "10000000-0000-4000-8000-000000000001",
    design: "10000000-0000-4000-8000-000000000002",
    growth: "10000000-0000-4000-8000-000000000003",
  },
  projects: {
    launch: "20000000-0000-4000-8000-000000000001",
    mobile: "20000000-0000-4000-8000-000000000002",
    research: "20000000-0000-4000-8000-000000000003",
    campaign: "20000000-0000-4000-8000-000000000004",
  },
} as const;

const taskDefinitions = [
  [
    "01",
    "launch",
    "Define launch success metrics",
    "TODO",
    "HIGH",
    0,
    "manager",
    9,
  ],
  [
    "02",
    "launch",
    "Prepare customer onboarding checklist",
    "TODO",
    "MEDIUM",
    1,
    "member",
    12,
  ],
  [
    "03",
    "launch",
    "Confirm production readiness",
    "TODO",
    "URGENT",
    2,
    "owner",
    4,
  ],
  [
    "04",
    "launch",
    "Build executive launch dashboard",
    "IN_PROGRESS",
    "HIGH",
    0,
    "manager",
    6,
  ],
  [
    "05",
    "launch",
    "Polish empty states and loading UI",
    "IN_PROGRESS",
    "MEDIUM",
    1,
    "designer",
    5,
  ],
  [
    "06",
    "launch",
    "Review accessibility acceptance criteria",
    "REVIEW",
    "HIGH",
    0,
    "designer",
    3,
  ],
  [
    "07",
    "launch",
    "Set up release communication channels",
    "DONE",
    "MEDIUM",
    0,
    "member",
    -1,
  ],
  [
    "08",
    "launch",
    "Approve product launch brief",
    "DONE",
    "HIGH",
    1,
    "owner",
    -3,
  ],
  [
    "09",
    "mobile",
    "Map mobile navigation flows",
    "TODO",
    "MEDIUM",
    0,
    "designer",
    14,
  ],
  [
    "10",
    "mobile",
    "Prototype offline task updates",
    "IN_PROGRESS",
    "HIGH",
    0,
    "member",
    8,
  ],
  [
    "11",
    "mobile",
    "Validate touch target sizing",
    "REVIEW",
    "MEDIUM",
    0,
    "designer",
    2,
  ],
  [
    "12",
    "mobile",
    "Document responsive breakpoints",
    "DONE",
    "LOW",
    0,
    "manager",
    -5,
  ],
  [
    "13",
    "research",
    "Synthesize interview themes",
    "IN_PROGRESS",
    "HIGH",
    0,
    "designer",
    7,
  ],
  [
    "14",
    "research",
    "Recruit five workspace admins",
    "DONE",
    "MEDIUM",
    0,
    "member",
    -7,
  ],
  [
    "15",
    "campaign",
    "Draft launch announcement",
    "TODO",
    "MEDIUM",
    0,
    "marketer",
    11,
  ],
  [
    "16",
    "campaign",
    "Build lifecycle email sequence",
    "IN_PROGRESS",
    "HIGH",
    0,
    "marketer",
    10,
  ],
  [
    "17",
    "campaign",
    "Review campaign creative",
    "REVIEW",
    "MEDIUM",
    0,
    "designer",
    4,
  ],
  [
    "18",
    "campaign",
    "Finalize audience segments",
    "DONE",
    "HIGH",
    0,
    "manager",
    -2,
  ],
] as const;

function relativeDate(days: number, hour = 10) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
}

function stableId(prefix: string, suffix: string) {
  return `${prefix.replace(/-$/, "")}-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

export async function seedDevelopmentData(database: PrismaClient) {
  return database.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      where: { slug: "worksphere-demo" },
      create: { name: "Northstar Collective", slug: "worksphere-demo" },
      update: {},
    });
    const secondOrganization = await transaction.organization.upsert({
      where: { slug: "worksphere-labs" },
      create: { name: "WorkSphere Labs", slug: "worksphere-labs" },
      update: {},
    });

    const userDefinitions = [
      ["owner", "owner@worksphere.example", "Maya Chen", "OWNER"],
      ["manager", "manager@worksphere.example", "Noah Williams", "MANAGER"],
      ["member", "member@worksphere.example", "Priya Shah", "MEMBER"],
      ["designer", "designer@worksphere.example", "Elena Rossi", "MEMBER"],
      ["marketer", "marketing@worksphere.example", "Marcus Reed", "VIEWER"],
    ] as const;
    const users = new Map<
      string,
      { id: string; name: string; email: string }
    >();
    for (const [key, email, name, role] of userDefinitions) {
      const existing = await transaction.user.findUnique({ where: { email } });
      const user = await transaction.user.upsert({
        where: { email },
        create: {
          email,
          name,
          emailVerifiedAt: relativeDate(-90),
          passwordHash: key === "owner" ? DEMO_PASSWORD_HASH : null,
        },
        update:
          key === "owner" && !existing?.passwordHash
            ? {
                passwordHash: DEMO_PASSWORD_HASH,
                emailVerifiedAt: existing?.emailVerifiedAt ?? relativeDate(-90),
              }
            : {},
      });
      users.set(key, user);
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
      await transaction.notificationPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, mentionEmail: key === "owner" },
        update: {},
      });
    }
    const owner = users.get("owner")!;
    await transaction.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: secondOrganization.id,
          userId: owner.id,
        },
      },
      create: {
        organizationId: secondOrganization.id,
        userId: owner.id,
        role: "OWNER",
      },
      update: {},
    });

    const teamDefinitions = [
      [
        "product",
        ids.teams.product,
        "Product & Engineering",
        "product-engineering",
      ],
      ["design", ids.teams.design, "Experience Design", "experience-design"],
      ["growth", ids.teams.growth, "Growth", "growth"],
    ] as const;
    const teams = new Map<string, { id: string; name: string }>();
    for (const [key, id, name, slug] of teamDefinitions) {
      const team = await transaction.team.upsert({
        where: {
          organizationId_slug: { organizationId: organization.id, slug },
        },
        create: { id, organizationId: organization.id, name, slug },
        update: {},
      });
      teams.set(key, team);
    }
    const teamMembers = {
      product: ["owner", "manager", "member"],
      design: ["owner", "designer"],
      growth: ["manager", "marketer"],
    } as const;
    for (const [teamKey, memberKeys] of Object.entries(teamMembers)) {
      for (const memberKey of memberKeys) {
        await transaction.teamMembership.upsert({
          where: {
            teamId_userId: {
              teamId: teams.get(teamKey)!.id,
              userId: users.get(memberKey)!.id,
            },
          },
          create: {
            teamId: teams.get(teamKey)!.id,
            userId: users.get(memberKey)!.id,
          },
          update: {},
        });
      }
    }

    const projectDefinitions = [
      [
        "launch",
        ids.projects.launch,
        "WorkSphere 2.0 Launch",
        "worksphere-2-launch",
        "Coordinate the final product, go-to-market, and customer-readiness work for the next release.",
        "product",
        "ACTIVE",
      ],
      [
        "mobile",
        ids.projects.mobile,
        "Mobile Experience",
        "mobile-experience",
        "Bring the core planning workflow to smaller screens with a focused, touch-first experience.",
        "design",
        "ACTIVE",
      ],
      [
        "research",
        ids.projects.research,
        "Customer Research Q4",
        "customer-research-q4",
        "Turn customer interviews and usage signals into clear opportunities for the next planning cycle.",
        "design",
        "ACTIVE",
      ],
      [
        "campaign",
        ids.projects.campaign,
        "Launch Campaign",
        "launch-campaign",
        "Build the narrative, assets, and lifecycle touchpoints for the WorkSphere 2.0 announcement.",
        "growth",
        "ACTIVE",
      ],
    ] as const;
    const projects = new Map<string, { id: string; name: string }>();
    for (const [
      key,
      id,
      name,
      slug,
      description,
      teamKey,
      status,
    ] of projectDefinitions) {
      const project = await transaction.project.upsert({
        where: {
          organizationId_slug: { organizationId: organization.id, slug },
        },
        create: {
          id,
          organizationId: organization.id,
          teamId: teams.get(teamKey)!.id,
          ownerId: owner.id,
          name,
          slug,
          description,
          status,
          boardRevision: 8,
        },
        update: {},
      });
      projects.set(key, project);
      for (const memberKey of [
        "owner",
        "manager",
        "member",
        "designer",
      ] as const) {
        await transaction.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: project.id,
              userId: users.get(memberKey)!.id,
            },
          },
          create: {
            projectId: project.id,
            userId: users.get(memberKey)!.id,
          },
          update: {},
        });
      }
    }

    const tasks = new Map<
      string,
      { id: string; title: string; projectId: string }
    >();
    for (const [
      suffix,
      projectKey,
      title,
      status,
      priority,
      position,
      assigneeKey,
      dueInDays,
    ] of taskDefinitions) {
      const id = stableId("30000000-", suffix);
      const task = await transaction.task.upsert({
        where: { id },
        create: {
          id,
          projectId: projects.get(projectKey)!.id,
          reporterId: owner.id,
          assigneeId: users.get(assigneeKey)!.id,
          title,
          description: `Demo task for ${projects.get(projectKey)!.name}. It includes enough context to demonstrate ownership, priority, due dates, comments, and board movement.`,
          status,
          priority,
          position,
          dueDate: relativeDate(dueInDays),
          createdAt: relativeDate(-Math.abs(dueInDays) - 8),
          updatedAt:
            status === "DONE" ? relativeDate(dueInDays) : relativeDate(-1),
        },
        update: {},
      });
      tasks.set(suffix, task);
    }

    const commentDefinitions = [
      [
        "01",
        "04",
        "manager",
        "The dashboard metrics are connected. @Maya Chen, can you review the launch-readiness score?",
        -2,
      ],
      [
        "02",
        "04",
        "owner",
        "Reviewed. Let us add the support-volume trend before the leadership walkthrough.",
        -1,
      ],
      [
        "03",
        "06",
        "designer",
        "Keyboard and screen-reader checks are complete. I left two small contrast notes in the brief.",
        -1,
      ],
      [
        "04",
        "10",
        "member",
        "The offline queue now reconciles changes in order after connectivity returns.",
        -3,
      ],
      [
        "05",
        "13",
        "designer",
        "Three themes are emerging: faster capture, clearer ownership, and less notification noise.",
        -2,
      ],
    ] as const;
    const comments = new Map<string, { id: string }>();
    for (const [suffix, taskKey, authorKey, body, days] of commentDefinitions) {
      const id = stableId("40000000-", suffix);
      const comment = await transaction.comment.upsert({
        where: { id },
        create: {
          id,
          taskId: tasks.get(taskKey)!.id,
          authorId: users.get(authorKey)!.id,
          body,
          createdAt: relativeDate(days, 14),
        },
        update: {},
      });
      comments.set(suffix, comment);
    }

    const activityDefinitions = [
      ["01", "task.created", "launch", "owner", "04", -8],
      ["02", "task.assigned", "launch", "owner", "04", -7],
      ["03", "task.moved", "launch", "manager", "04", -5],
      ["04", "comment.created", "launch", "manager", "04", -2],
      ["05", "comment.created", "launch", "owner", "04", -1],
      ["06", "task.status_changed", "launch", "designer", "06", -1],
      ["07", "task.moved", "mobile", "member", "10", -3],
      ["08", "task.status_changed", "mobile", "manager", "12", -5],
      ["09", "comment.created", "research", "designer", "13", -2],
      ["10", "task.status_changed", "campaign", "manager", "18", -2],
      ["11", "project.created", "campaign", "manager", null, -14],
      ["12", "project.updated", "mobile", "owner", null, -6],
    ] as const;
    for (const [
      suffix,
      action,
      projectKey,
      actorKey,
      taskKey,
      days,
    ] of activityDefinitions) {
      const taskId = taskKey ? tasks.get(taskKey)!.id : undefined;
      await transaction.activityEvent.upsert({
        where: { id: stableId("50000000-", suffix) },
        create: {
          id: stableId("50000000-", suffix),
          organizationId: organization.id,
          projectId: projects.get(projectKey)!.id,
          actorId: users.get(actorKey)!.id,
          action,
          metadata: taskId
            ? {
                taskId,
                fromStatus: "TODO",
                toStatus: "IN_PROGRESS",
                position: 0,
              }
            : {},
          createdAt: relativeDate(days, 15),
        },
        update: { createdAt: relativeDate(days, 15) },
      });
    }

    const notificationDefinitions = [
      ["01", "MENTION", "manager", "launch", "04", "01", false, -2],
      ["02", "ASSIGNMENT", "owner", "launch", "03", null, false, -1],
      ["03", "STATUS_CHANGE", "designer", "launch", "06", null, true, -1],
      ["04", "REMINDER", "manager", "mobile", "11", null, false, 0],
    ] as const;
    for (const [
      suffix,
      kind,
      actorKey,
      projectKey,
      taskKey,
      commentKey,
      read,
      days,
    ] of notificationDefinitions) {
      await transaction.notification.upsert({
        where: { id: stableId("60000000-", suffix) },
        create: {
          id: stableId("60000000-", suffix),
          recipientId: owner.id,
          actorId: users.get(actorKey)!.id,
          organizationId: organization.id,
          projectId: projects.get(projectKey)!.id,
          taskId: tasks.get(taskKey)!.id,
          commentId: commentKey ? comments.get(commentKey)!.id : null,
          kind,
          metadata: { source: "demo-seed" },
          readAt: read ? relativeDate(days, 17) : null,
          createdAt: relativeDate(days, 16),
        },
        update: {},
      });
    }

    for (const [key, team] of teams) {
      await transaction.conversation.upsert({
        where: { teamId: team.id },
        create: {
          id: stableId(
            "70000000-",
            key === "product" ? "01" : key === "design" ? "02" : "03",
          ),
          organizationId: organization.id,
          kind: "TEAM",
          teamId: team.id,
        },
        update: {},
      });
    }
    const launchConversation = await transaction.conversation.upsert({
      where: { projectId: projects.get("launch")!.id },
      create: {
        id: stableId("70000000-", "11"),
        organizationId: organization.id,
        kind: "PROJECT",
        projectId: projects.get("launch")!.id,
      },
      update: {},
    });
    const messageDefinitions = [
      [
        "01",
        "owner",
        "Welcome to the launch room. Use this thread for decisions that affect more than one team.",
        -4,
      ],
      [
        "02",
        "manager",
        "The release checklist is in good shape. Production readiness is the only urgent item left.",
        -2,
      ],
      [
        "03",
        "designer",
        "Accessibility review is ready. I added the final notes to the review card.",
        -1,
      ],
    ] as const;
    for (const [suffix, authorKey, body, days] of messageDefinitions) {
      await transaction.chatMessage.upsert({
        where: { id: stableId("71000000-", suffix) },
        create: {
          id: stableId("71000000-", suffix),
          conversationId: launchConversation.id,
          authorId: users.get(authorKey)!.id,
          body,
          createdAt: relativeDate(days, 11),
        },
        update: {},
      });
    }
    await transaction.conversationReadState.upsert({
      where: {
        conversationId_userId: {
          conversationId: launchConversation.id,
          userId: owner.id,
        },
      },
      create: {
        conversationId: launchConversation.id,
        userId: owner.id,
        lastReadAt: relativeDate(-2),
      },
      update: {},
    });

    await transaction.invitation.upsert({
      where: { tokenHash: "d".repeat(64) },
      create: {
        id: stableId("80000000-", "01"),
        organizationId: organization.id,
        inviterId: owner.id,
        email: "alex.morgan@worksphere.example",
        role: "MEMBER",
        tokenHash: "d".repeat(64),
        status: "PENDING",
        expiresAt: relativeDate(7),
      },
      update: { expiresAt: relativeDate(7) },
    });
    await transaction.billingSubscription.upsert({
      where: { organizationId: organization.id },
      create: {
        id: stableId("90000000-", "01"),
        organizationId: organization.id,
        provider: "local",
        externalCustomerId: `demo-${organization.id}`,
        externalSubscriptionId: `demo-subscription-${organization.id}`,
        plan: "TEAM",
        status: "ACTIVE",
        currentPeriodEnd: relativeDate(24),
      },
      update: {},
    });
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    await transaction.usageCounter.upsert({
      where: {
        organizationId_metric_periodStart: {
          organizationId: organization.id,
          metric: "CHAT_MESSAGES",
          periodStart,
        },
      },
      create: {
        organizationId: organization.id,
        metric: "CHAT_MESSAGES",
        periodStart,
        count: 1842,
      },
      update: {},
    });

    const auditDefinitions = [
      [
        "01",
        "organization.updated",
        "organization",
        organization.id,
        "owner",
        -12,
      ],
      [
        "02",
        "project.created",
        "project",
        projects.get("campaign")!.id,
        "manager",
        -10,
      ],
      ["03", "team.updated", "team", teams.get("design")!.id, "owner", -6],
      [
        "04",
        "invitation.created",
        "invitation",
        stableId("80000000-", "01"),
        "owner",
        -3,
      ],
      [
        "05",
        "billing.subscription_changed",
        "subscription",
        stableId("90000000-", "01"),
        "owner",
        -1,
      ],
    ] as const;
    await transaction.auditEvent.createMany({
      data: auditDefinitions.map(
        ([suffix, action, targetType, targetId, actorKey, days]) => ({
          id: stableId("a0000000-", suffix),
          tenantId: organization.id,
          actorId: users.get(actorKey)!.id,
          action,
          targetType,
          targetId,
          metadata: { source: "demo-seed" },
          createdAt: relativeDate(days, 13),
        }),
      ),
      skipDuplicates: true,
    });

    return {
      organizations: [organization.slug, secondOrganization.slug],
      users: users.size,
      teams: teams.size,
      projects: projects.size,
      tasks: tasks.size,
      demoLogin: "owner@worksphere.example",
    };
  });
}
