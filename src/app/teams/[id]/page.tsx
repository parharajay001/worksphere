import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageCircle, Users } from "lucide-react";
import { ConversationChat } from "@/components/conversation-chat";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { ensureConversation, listMessages } from "@/modules/chat/chat.service";
import { teamIdSchema } from "@/modules/teams/team.schemas";
import { getTeam } from "@/modules/teams/team.service";

export const dynamic = "force-dynamic";

export default async function TeamRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const parsed = teamIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let team;
  try {
    team = await getTeam(user.id, parsed.data.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const conversation = await ensureConversation(user.id, { teamId: team.id });
  const messages = await listMessages(user.id, conversation.id, { limit: 30 });
  const participants = team.memberships.map(({ user: member }) => member);

  return (
    <article className="overview protected-overview team-room-page">
      <div className="page-breadcrumbs">
        <Link href="/teams">Teams</Link>
        <span>/</span>
        {team.name}
      </div>
      <header className="team-room-header">
        <div className="team-room-title">
          <span>{team.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <p className="eyebrow accent">TEAM ROOM</p>
            <h1>{team.name}</h1>
          </div>
        </div>
        <div className="team-room-meta">
          <span>
            <Users size={15} /> {participants.length} members
          </span>
          <span>
            <MessageCircle size={15} /> Shared conversation
          </span>
        </div>
      </header>
      <p className="intro">
        A durable room for updates and decisions shared by this team.
      </p>
      <ConversationChat
        scope={{ kind: "team", id: team.id }}
        conversationId={conversation.id}
        currentUserId={user.id}
        participants={participants}
        initialPage={messages}
        title={`${team.name} chat`}
      />
    </article>
  );
}
