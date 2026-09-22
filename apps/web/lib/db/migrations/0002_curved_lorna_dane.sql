CREATE TABLE "reveals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_card_id" text NOT NULL,
	"payment_method_id" text,
	"description" text,
	"amount" jsonb NOT NULL,
	"merchant" jsonb,
	"rail" text NOT NULL,
	"provider" text,
	"enforced" boolean,
	"requester" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reveals_user_id_created_at_idx" ON "reveals" USING btree ("user_id","created_at");