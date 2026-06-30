CREATE INDEX IF NOT EXISTS "TeamMembership_userId_role_idx" ON "TeamMembership"("userId", "role");
CREATE INDEX IF NOT EXISTS "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");
