CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_address` text NOT NULL,
	`owner_address` text NOT NULL,
	`relayer_address` text NOT NULL,
	`deployment_tx_hash` text NOT NULL,
	`reward_amount_wei` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_contract_address_unique` ON `campaigns` (`contract_address`);