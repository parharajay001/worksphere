import "server-only";
export type InvitationEmail = {
  to: string;
  organizationName: string;
  token: string;
  idempotencyKey: string;
};
export type EmailDelivery = (email: InvitationEmail) => Promise<void>;
/** Provider seam called only by the email worker. Forward idempotencyKey to the provider. */
export const deliverInvitationEmail: EmailDelivery = async () => undefined;
