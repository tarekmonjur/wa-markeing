# Team Roles & Permissions

## What This Does

Team roles let you invite colleagues to your account and control exactly what they can do. An **Admin** has full access, an **Agent** can send messages and view analytics but cannot change settings, and a **Viewer** can only read data.

## Roles

| Role | Who It's For |
|------|-------------|
| `ADMIN` | Account owner and trusted managers — full control |
| `AGENT` | Sales or support staff — can run campaigns and view results |
| `VIEWER` | Stakeholders, clients, auditors — read-only access |

## Permissions Matrix

| Action | ADMIN | AGENT | VIEWER |
|--------|-------|-------|--------|
| View dashboard & analytics | ✅ | ✅ | ✅ |
| View contacts & groups | ✅ | ✅ | ✅ |
| View templates | ✅ | ✅ | ✅ |
| View campaigns | ✅ | ✅ | ✅ |
| View inbox | ✅ | ✅ | ✅ |
| Create / edit contacts | ✅ | ✅ | ❌ |
| Import contacts (CSV / Sheets) | ✅ | ✅ | ❌ |
| Create / edit templates | ✅ | ✅ | ❌ |
| Create / start campaigns | ✅ | ✅ | ❌ |
| Pause / cancel campaigns | ✅ | ✅ | ❌ |
| Send manual inbox reply | ✅ | ✅ | ❌ |
| Manage auto-reply rules | ✅ | ✅ | ❌ |
| Manage drip sequences | ✅ | ✅ | ❌ |
| Delete contacts / campaigns | ✅ | ❌ | ❌ |
| Manage WhatsApp sessions | ✅ | ❌ | ❌ |
| Export analytics reports | ✅ | ✅ | ❌ |
| Manage webhooks & integrations | ✅ | ❌ | ❌ |
| Invite / remove team members | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |

Any attempt by an Agent or Viewer to perform a forbidden action returns **`403 Forbidden`**.

## Step-by-Step

### 1. Invite a Team Member

Navigate to **Settings → Team → Invite Member**, or via API:

```
POST /api/v1/teams/members/invite
{
  "email": "agent@example.com",
  "role": "AGENT"
}
```

An invitation email is sent to the address. The invitee registers (or logs in if they already have an account) and is added to your team.

### 2. View Team Members

```
GET /api/v1/teams/members
```

Returns a list of all members with their role, email, name, and join date.

### 3. Change a Member's Role

```
PATCH /api/v1/teams/members/:memberId
{
  "role": "VIEWER"
}
```

Role changes take effect immediately — the member's next API request will be evaluated under the new role without requiring re-login.

### 4. Remove a Member

```
DELETE /api/v1/teams/members/:memberId
```

Revokes the member's access immediately. Their account is not deleted — only the team membership is removed. Any campaigns or contacts they created remain unchanged.

## How Role Checks Work

Every protected API endpoint uses the `@Roles()` decorator enforced by `RolesGuard`. The guard reads the role from the authenticated user's JWT and compares it against the endpoint's required roles:

```
Request → JwtAuthGuard (verify token) → RolesGuard (check role) → Controller
```

If the user's role is insufficient the request is rejected with `403 Forbidden` before reaching any business logic.

## API Endpoints

```
GET    /api/v1/teams/members                  — List all team members
POST   /api/v1/teams/members/invite           — Invite a new member (ADMIN only)
PATCH  /api/v1/teams/members/:id              — Update member role (ADMIN only)
DELETE /api/v1/teams/members/:id              — Remove member (ADMIN only)
```

## Limitations

- Only one user holds the `ADMIN` role as the account owner — additional admins can be assigned but the original owner cannot be removed
- The owner (account creator) cannot be removed from the team
- Maximum team members per plan: FREE = 1 (owner only), STARTER = 3, PRO = 10, AGENCY = unlimited

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `403 Forbidden` on campaign create | User is a VIEWER | Upgrade the member's role to AGENT or ADMIN |
| Invited member can't log in | Invitation email not received | Check spam; re-send via `POST /api/v1/teams/members/invite` with the same email |
| Role change not taking effect | Member using a cached JWT | Member must log out and back in (JWT TTL is 15 minutes — change takes effect on next refresh) |
| Can't remove a member | Trying to remove the account owner | The owner cannot be removed; transfer ownership first if needed |
