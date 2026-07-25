CREATE TABLE `relay_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`holder` text DEFAULT '' NOT NULL,
	`expires_at` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `deployment_block` integer;