ALTER TABLE "checkouts" ALTER COLUMN "agent_card_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checkouts" ADD COLUMN "agent_card_request_id" text;