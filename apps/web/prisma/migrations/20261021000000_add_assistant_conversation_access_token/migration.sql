-- Private capability for anonymous Ask Francisco conversations. designId is a
-- shareable design label (Floor Studio share links carry it) and must not be
-- the credential for the transcript/photos. Stored as a SHA-256 hex digest;
-- NULL on pre-existing rows (unreadable by anonymous callers).
ALTER TABLE "ecowoods"."AssistantConversation" ADD COLUMN "accessTokenHash" VARCHAR(64);
