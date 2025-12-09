import type { Message, MessageEntity } from "grammy/types";

export function isBotMentioned(message: Message, botUsername: string): boolean {
  if (!botUsername) return false;

  const textEntities = message.entities || [];
  const captionEntities = message.caption_entities || [];

  if (!textEntities.length && !captionEntities.length) return false;

  const checkEntities = (entities: MessageEntity[], text: string) =>
    entities.some((entity) => {
      if (entity.type === "mention") {
        const mention = extractMentionText(text, entity).toLowerCase();
        return mention === `@${botUsername.toLowerCase()}`;
      }
      return false;
    });

  return checkEntities(textEntities, message.text || "") || checkEntities(captionEntities, message.caption || "");
}

function extractMentionText(text: string, entity: MessageEntity): string {
  return text.slice(entity.offset, entity.offset + entity.length);
}
