CREATE TABLE IF NOT EXISTS "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"pax" integer DEFAULT 1 NOT NULL,
	"ig_handle" text DEFAULT '' NOT NULL,
	"ig_platform" text DEFAULT 'instagram' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "submissions" ADD CONSTRAINT "submissions_event_id_events_id_fk"
 FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submissions_event_idx" ON "submissions" USING btree ("event_id");
