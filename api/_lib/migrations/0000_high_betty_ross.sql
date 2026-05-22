CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"venue_id" integer,
	"weekdays" text[] DEFAULT '{}' NOT NULL,
	"selected_slot_ids" text[] DEFAULT '{}' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_late_club" boolean DEFAULT false NOT NULL,
	"invited_guests" text[] DEFAULT '{}' NOT NULL,
	"is_one_time" boolean DEFAULT false NOT NULL,
	"event_date" date,
	"capacity" integer,
	"season_start" date,
	"season_end" date,
	"share_token" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_id" integer NOT NULL,
	"venue_id" integer,
	"club_event_id" integer,
	"name" text NOT NULL,
	"invite_type_ids" text[] DEFAULT '{}' NOT NULL,
	"invite_type_names" text[] DEFAULT '{}' NOT NULL,
	"pax" integer DEFAULT 1 NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"influencer" boolean DEFAULT false NOT NULL,
	"ig_handle" text DEFAULT '' NOT NULL,
	"ig_platform" text DEFAULT 'instagram' NOT NULL,
	"notes" text,
	"event_date" date,
	"submission_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"venue_id" integer NOT NULL,
	"event_id" integer,
	"name" text NOT NULL,
	"phone_code" text DEFAULT '+34' NOT NULL,
	"phone_num" text DEFAULT '' NOT NULL,
	"vip_type" text DEFAULT '' NOT NULL,
	"time" text DEFAULT '20:00' NOT NULL,
	"pax" integer DEFAULT 2 NOT NULL,
	"from_invite" boolean DEFAULT false NOT NULL,
	"inviter_handle" text DEFAULT '' NOT NULL,
	"inviter_platform" text DEFAULT 'instagram' NOT NULL,
	"commission_pct" numeric(5, 2) DEFAULT '10' NOT NULL,
	"woman_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"commission_earner" text DEFAULT '' NOT NULL,
	"event_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"guest_capacity" integer DEFAULT 0 NOT NULL,
	"phone_code" text,
	"phone_num" text,
	"timeslots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vip_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invite_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_tenant_idx" ON "events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "events_venue_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "guests_tenant_idx" ON "guests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "guests_event_idx" ON "guests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "reservations_tenant_idx" ON "reservations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "reservations_venue_idx" ON "reservations" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venues_tenant_idx" ON "venues" USING btree ("tenant_id");