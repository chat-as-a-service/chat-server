import { kafkaProducer } from '../infrastructure/kafka';
import { type CreateMessagePayload, type MessageType } from '../types/message';
import { type LinkPreviewKafkaPayload } from '../types/link-preview';

export const KafkaMessageRepository = {
  async sendMessage(message: MessageType) {
    await kafkaProducer.send({
      topic: 'chat-message',
      messages: [{ value: JSON.stringify(message) }],
    });
  },
  async sendMessageSave(
    message: CreateMessagePayload & {
      application_uuid: string;
      message_uuid: string;
      created_at: number;
      username: string;
    },
  ) {
    await kafkaProducer.send({
      topic: 'chat-message-save',
      messages: [{ value: JSON.stringify(message) }],
    });
  },

  async queueLinkPreview(messageId: number, link: string) {
    const payload: LinkPreviewKafkaPayload = {
      message_id: messageId,
      link,
    };
    await kafkaProducer.send({
      topic: 'chat-message-link-preview',
      messages: [
        {
          value: JSON.stringify(payload),
        },
      ],
    });
    console.debug(
      `Queued link preview for message ${messageId}, link: ${link}`,
    );
  },
};
