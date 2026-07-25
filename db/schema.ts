import { sql } from 'drizzle-orm'
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull().default(''),
    marketingConsent: integer('marketing_consent', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
)

export const campaignRegistrations = sqliteTable(
  'campaign_registrations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id').notNull(),
    walletAddress: text('wallet_address'),
    claimTxHash: text('claim_tx_hash'),
    claimStatus: text('claim_status').notNull().default('registered'),
    registeredAt: text('registered_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    walletLinkedAt: text('wallet_linked_at'),
    claimedAt: text('claimed_at'),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('campaign_registration_user_unique').on(
      table.userId,
      table.campaignId,
    ),
    uniqueIndex('campaign_registration_wallet_unique')
      .on(table.walletAddress, table.campaignId)
      .where(sql`${table.walletAddress} IS NOT NULL`),
  ],
)

export const campaigns = sqliteTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    contractAddress: text('contract_address').notNull(),
    ownerAddress: text('owner_address').notNull(),
    relayerAddress: text('relayer_address').notNull(),
    deploymentTxHash: text('deployment_tx_hash').notNull(),
    deploymentBlock: integer('deployment_block'),
    rewardAmountWei: text('reward_amount_wei').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('campaigns_contract_address_unique').on(table.contractAddress),
  ],
)

export const relayLocks = sqliteTable('relay_locks', {
  id: text('id').primaryKey(),
  holder: text('holder').notNull().default(''),
  expiresAt: integer('expires_at').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})
