export const emailQueueName = "worksphere-email-v1";

export type InvitationEmailJob = {
  invitationId: string;
  token: string;
};

export type EmailJobMap = {
  "invitation.email": InvitationEmailJob;
};
