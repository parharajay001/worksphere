import "server-only";
export type InvitationEmail = {
  to: string;
  organizationName: string;
  token: string;
};
export type EmailDelivery = (email: InvitationEmail) => Promise<void>;
/** Provider seam; production wiring can enqueue this without changing invitation logic. */
export const deliverInvitationEmail: EmailDelivery = async () => undefined;
