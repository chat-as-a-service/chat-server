import { kafkaProducer } from '../infrastructure/kafka';
import {
  type LinkPreviewKafkaPayload,
  type NewMessageKafkaPayload,
} from '../dto/kafka/message.kafka.dto';
import { type ESMessage } from '../dto/es/message.es.dto';

export const KafkaMessageRepository = {
  async sendMessage(message: ESMessage) {
    await kafkaProducer.send({
      topic: 'chat-message',
      messages: [{ value: JSON.stringify(message) }],
    });
  },

  async sendMessageSave(
    message: NewMessageKafkaPayload,
    headers?: Record<string, string>,
  ) {
    await kafkaProducer.send({
      topic: 'chat-message-save',
      messages: [
        {
          headers,
          key: message.channel_uuid,
          value: JSON.stringify(message),
        },
      ],
    });
  },

  async queueLinkPreview(
    appUuid: string,
    channelUuid: string,
    messageUuid: string,
    link: string,
  ) {
    const payload: LinkPreviewKafkaPayload = {
      application_uuid: appUuid,
      channel_uuid: channelUuid,
      message_uuid: messageUuid,
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
      `Queued link preview for message ${messageUuid}, link: ${link}`,
    );
  },
};
