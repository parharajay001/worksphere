# Day 9 verification — invitations and teams

Day 9 adds organization invitations and teams. Invitation tokens are random,
stored only as SHA-256 hashes, expire after seven days, and are single-use.
Accepting an invitation requires an authenticated user whose normalized email
matches the invitation; acceptance and membership creation are transactional.
Owners and admins can revoke or resend invitations through the service boundary.

`src/modules/notifications/email.ts` is the delivery seam. It is a safe no-op
for local development and can be replaced by an email provider or queue later.
The invitation API returns the one-time token to the authorized inviter so a
local workflow can deliver it manually without provider credentials.

Teams are organization-owned, use an organization-scoped unique slug, and can
only be created or listed after permission and membership checks. Their
membership table is ready for the team-management milestone.
