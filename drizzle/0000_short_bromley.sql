CREATE TABLE `campaign_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`wallet_address` text,
	`claim_tx_hash` text,
	`claim_status` text DEFAULT 'registered' NOT NULL,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`wallet_linked_at` text,
	`claimed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_registration_user_unique` ON `campaign_registrations` (`user_id`,`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_registration_wallet_unique` ON `campaign_registrations` (`wallet_address`,`campaign_id`) WHERE "campaign_registrations"."wallet_address" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);