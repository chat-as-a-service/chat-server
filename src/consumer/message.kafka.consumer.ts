import { type KafkaMessage } from 'kafkajs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { LinkPreview } from '../entity/link-preview.entity';
import { LinkPreviewGcsRepository } from '../repository/link-preview.gcs.repository';
import { LinkPreviewWebRepository } from '../repository/link-preview.web.repository';
import { LinkPreviewRepository } from '../repository/link-preview.repository';
import { MessageRepository } from '../repository/message.repository';
import { postgresqlDataSource } from '../infrastructure/database';
import { ChannelRepository } from '../repository/channel.repository';
import { UserRepository } from '../repository/user.repository';
import { Message } from '../entity/message.entity';
import { RedisProfanityFilterRepository } from '../repository/profanity-filter.redis.repository';
import { KafkaMessageRepository } from '../repository/message.kafka.repository';
import tracer from '../infrastructure/datadog';
import { type Span } from 'dd-trace';
import {
  type LinkPreviewKafkaPayload,
  type NewMessageKafkaPayload,
} from '../dto/kafka/message.kafka.dto';
import { type ESMessage } from '../dto/es/message.es.dto';
import { MessageEsRepository } from '../repository/es/message.es.repository';
import type { MessageType } from '../types/message';
import { AttachmentGcsRepository } from '../repository/attachment.gcs.repository';
import { io } from '../index';

puppeteer.use(StealthPlugin());
const URL_REGEX = /https?:\/\/[^\s]+/;

export const MessageKafkaConsumer = {
  /**
   * Fetching OpenGraph tags from link
   * @param kafkaMessage
   */
  async consumeLinkPreviewMessages(kafkaMessage: KafkaMessage) {
    const messageValue = kafkaMessage.value?.toString();
    console.debug(
      `Consumed kafka message for link preview. Payload: ${messageValue}`,
    );
    if (messageValue == null) {
      console.warn('kafka link preview message is empty');
      return;
    }
    const linkPreviewPayload: LinkPreviewKafkaPayload =
      JSON.parse(messageValue);

    const linkPreviewEntity = new LinkPreview();
    linkPreviewEntity.url = linkPreviewPayload.link;
    linkPreviewEntity.createdBy = 'system';
    linkPreviewEntity.updatedBy = 'system';

    const ogTags = await LinkPreviewWebRepository.fetchOgTags(
      linkPreviewPayload.link,
    );
    if (ogTags.image != null) {
      linkPreviewEntity.imageLink =
        await LinkPreviewGcsRepository.uploadPreviewImage(
          ogTags.image,
          linkPreviewPayload.link,
        );
    }
    linkPreviewEntity.title = ogTags.title;
    linkPreviewEntity.description = ogTags.description;
    linkPreviewEntity.imageWidth = ogTags.imageWidth;
    linkPreviewEntity.imageHeight = ogTags.imageHeight;
    linkPreviewEntity.imageAlt = ogTags.imageAlt;
    try {
      await postgresqlDataSource.manager.transaction(async manager => {
        const linkPreviewRepository = manager.withRepository(
          LinkPreviewRepository,
        );
        const messageRepository = manager.withRepository(MessageRepository);
        const existingLinkPreviewEntity = await linkPreviewRepository.findOneBy(
          {
            url: linkPreviewPayload.link,
          },
        );

        let validLinkPreviewEntity = linkPreviewEntity;
        if (existingLinkPreviewEntity == null) {
          await linkPreviewRepository.save(linkPreviewEntity);
        } else {
          console.debug(
            `Link preview for link ${linkPreviewPayload.link} already exists. Skipping insert.`,
          );
          validLinkPreviewEntity = existingLinkPreviewEntity;
        }

        const message = await messageRepository.findOneBy({
          uuid: linkPreviewPayload.message_uuid,
        });
        if (message == null) {
          throw new Error(
            `Message UUID: ${linkPreviewPayload.message_uuid} is not valid`,
          );
        }
        message.linkPreview = validLinkPreviewEntity;
        await messageRepository.save(message);

        await MessageEsRepository.updateMessageOgTags(
          linkPreviewPayload.application_uuid,
          linkPreviewPayload.channel_uuid,
          linkPreviewPayload.message_uuid,
          linkPreviewPayload.link,
          ogTags,
        );
        console.debug(`Updated opengraph tags for message with UUID: ${linkPreviewPayload.message_uuid}`)
      });

      const updatedMessage = await MessageEsRepository.getMessage(
        linkPreviewPayload.application_uuid,
        linkPreviewPayload.channel_uuid,
        linkPreviewPayload.message_uuid,
      );
      if (updatedMessage == null) {
        throw new Error(`Could not find message with UUID in ES: ${linkPreviewPayload.message_uuid}`)
      }

      const response: MessageType = {
        uuid: updatedMessage.uuid,
        message: updatedMessage.message,
        user: {
          username: updatedMessage.user.username,
          nickname: updatedMessage.user.nickname,
        },
        mention_type: updatedMessage.mention_type,
        mentioned_users: updatedMessage.mentioned_users.map(user => {
          return {
            username: user.username,
            nickname: user.nickname,
          };
        }),
        attachments: await Promise.all(
          updatedMessage.attachments.map(async attachment => ({
            original_file_name: attachment.original_file_name,
            content_type: attachment.content_type,
            download_signed_url: await AttachmentGcsRepository.signDownloadLink(
              attachment.file_key,
              attachment.original_file_name,
            ),
          })),
        ),
        thread_info: updatedMessage.thread_info,
        og_tag: updatedMessage.og_tag,
        created_at: updatedMessage.created_at,
        updated_at: updatedMessage.updated_at,
        channel_uuid: updatedMessage.channel.uuid,
        reactions: updatedMessage.reactions.map(reaction => {
          return {
            reaction: reaction.reaction,
            user: reaction.user,
            created_at: reaction.created_at
          };
        }),
      };

      io.to(updatedMessage.channel.uuid).emit('message:updated', response);
      console.debug(`Emitted 'message:updated' event for message ${updatedMessage.uuid}`);
    } catch (err) {
      console.error('Could not save link preview', { cause: err});
      throw err;
    }
  },

  async consumeMessage(kafkaMessage: KafkaMessage) {
    const headers: Record<string, string> = {};
    for (const key of Object.keys(kafkaMessage.headers ?? {})) {
      headers[key] = String(kafkaMessage.headers?.[key]);
    }
    const parentSpanContext = tracer.extract('text_map', headers);
    console.debug('consuming new message. headers: ', headers);
    let span: Span;
    if (parentSpanContext != null) {
      span = tracer.startSpan('consumeNewMessage', {
        childOf: parentSpanContext,
      });
      console.debug('parent span context: ', parentSpanContext);
    } else {
      span = tracer.startSpan('consumeNewMessage');
      console.debug('parent span context is null');
    }
    const messageValue = kafkaMessage.value?.toString();
    console.debug(
      `Consumed kafka message for chat message. Payload: ${messageValue}`,
    );

    if (messageValue == null) {
      console.warn('kafka chat message is empty');
      return;
    }
    const msg: NewMessageKafkaPayload = JSON.parse(messageValue);

    const channel = await ChannelRepository.findUserInChannel(
      msg.channel_uuid,
      msg.user.username,
      msg.application_uuid,
    );
    const user = await UserRepository.findByUsernameAndAppUuid(
      msg.user.username,
      msg.application_uuid,
    );
    if (channel == null || user == null) {
      return;
    }

    const newMessage = new Message();

    if (msg.parent_message_uuid != null) {
      const parentMessage = await MessageRepository.findOneBy({
        uuid: msg.parent_message_uuid,
      });
      if (parentMessage != null) {
        newMessage.parentMessage = parentMessage;
      }
    }

    newMessage.user = user;
    newMessage.channel = channel;
    newMessage.message =
      await RedisProfanityFilterRepository.maskBadWordsFromMessage(msg.message);
    newMessage.uuid = msg.uuid
    // todo
    newMessage.attachments = msg.attachments;
    newMessage.mentionType = msg.mention_type;
    if (msg.mention_type === 'USERS') {
      newMessage.mentionedUsers = await UserRepository.findUsersByUsername(
        msg.mentioned_usernames,
      );
    }

    const createdAt = new Date(msg.created_at);
    newMessage.createdAt = createdAt;
    newMessage.updatedAt = createdAt;
    newMessage.createdBy = msg.user.username;
    newMessage.updatedBy = msg.user.username;

    await MessageRepository.save(newMessage);

    const possibleUrl = msg.message.match(URL_REGEX)?.[0];
    if (possibleUrl != null) {
      console.info(
        `Found url ${possibleUrl} in message ${newMessage.id}, queuing link preview`,
      );
      await KafkaMessageRepository.queueLinkPreview(
        msg.application_uuid,
        msg.channel_uuid,
        newMessage.uuid,
        possibleUrl,
      );
    }

    const esMessage: ESMessage = {
      id: newMessage.id,
      uuid: newMessage.uuid,
      message: newMessage.message,
      application_uuid: msg.application_uuid,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
      },
      channel: {
        id: channel.id,
        uuid: channel.uuid,
        name: channel.name,
      },
      reactions: [],
      mention_type: newMessage.mentionType,
      mentioned_users:
        newMessage.mentionedUsers?.map(user => ({
          id: user.id,
          username: user.username,
          nickname: user.nickname,
        })) ?? [],
      attachments: msg.attachments,
      parent_message_id: newMessage.parentMessage?.id,
      parent_message_uuid: newMessage.parentMessage?.uuid,
      created_at: newMessage.createdAt.valueOf(),
      updated_at: newMessage.updatedAt.valueOf(),
    };

    await MessageEsRepository.saveMessage(esMessage);

    span.finish();
  },
};
