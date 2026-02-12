CREATE TABLE `message_meta` (
	`chat_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`transcription` text,
	`skill_context` text,
	`waiting_state` text,
	`extra` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`chat_id`, `message_id`)
);
