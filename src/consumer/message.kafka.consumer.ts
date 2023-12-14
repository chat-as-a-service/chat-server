import { type KafkaMessage } from 'kafkajs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { LinkPreview } from '../entity/link-preview.entity';
import { LinkPreviewGcsRepository } from '../repository/link-preview.gcs.repository';
import { type LinkPreviewKafkaPayload } from '../types/link-preview';
import { LinkPreviewWebRepository } from '../repository/link-preview.web.repository';
import { LinkPreviewRepository } from '../repository/link-preview.repository';
import { MessageRepository } from '../repository/message.repository';
import { postgresqlDataSource } from '../infrastructure/database';
import { ChannelRepository } from '../repository/channel.repository';
import { UserRepository } from '../repository/user.repository';
import { Message } from '../entity/message.entity';
import { RedisProfanityFilterRepository } from '../repository/profanity-filter.redis.repository';
import { randomUUID } from 'crypto';
import type { CreateMessagePayload, MessageType } from '../types/message';
import { AttachmentGcsRepository } from '../repository/attachment.gcs.repository';
import { KafkaMessageRepository } from '../repository/message.kafka.repository';

puppeteer.use(StealthPlugin());
const URL_REGEX = /https?:\/\/[^\s]+/;

export const MessageKafkaConsumer = {
    async consumeLinkPreviewMessages(kafkaMessage: KafkaMessage) {
        const messageValue = kafkaMessage.value?.toString();
        console.debug(`Consumed kafka message for link preview. Payload: ${messageValue}`)
        if (messageValue == null) {
            console.warn('kafka link preview message is empty')
            return;
        }
        const linkPreviewPayload: LinkPreviewKafkaPayload = JSON.parse(messageValue)

        const linkPreviewEntity = new LinkPreview();
        linkPreviewEntity.url = linkPreviewPayload.link
        linkPreviewEntity.createdBy = 'system'
        linkPreviewEntity.updatedBy = 'system'

        const ogTags = await LinkPreviewWebRepository.fetchOgTags(linkPreviewPayload.link);
        if (ogTags.image != null) {
            linkPreviewEntity.imageLink = await LinkPreviewGcsRepository.uploadPreviewImage(ogTags.image, linkPreviewPayload.link)
        }
        linkPreviewEntity.title = ogTags.title;
        linkPreviewEntity.description = ogTags.description;
        linkPreviewEntity.imageWidth = ogTags.imageWidth;
        linkPreviewEntity.imageHeight = ogTags.imageHeight;
        linkPreviewEntity.imageAlt = ogTags.imageAlt;
        await postgresqlDataSource.manager.transaction( async manager => {
            const linkPreviewRepository = manager.withRepository(LinkPreviewRepository);
            const messageRepository = manager.withRepository(MessageRepository);
            const existingLinkPreviewEntity = await linkPreviewRepository.findOneBy({url: linkPreviewPayload.link})

            let validLinkPreviewEntity = linkPreviewEntity
            if (existingLinkPreviewEntity == null) {
                await linkPreviewRepository.save(linkPreviewEntity);
            }else {
                console.debug(`Link preview for link ${linkPreviewPayload.link} already exists. Skipping insert.`)
                validLinkPreviewEntity = existingLinkPreviewEntity
            }

            const message = await messageRepository.findOneBy({id: linkPreviewPayload.message_id});
            if (message == null) {
                console.warn(`Message ID: ${linkPreviewPayload.message_id} is not valid`)
                return;
            }
            message.linkPreview = validLinkPreviewEntity;
            await messageRepository.save(message)
        })


    },

    async consumeMessage(kafkaMessage: KafkaMessage) {
        const messageValue = kafkaMessage.value?.toString();
        console.debug(`Consumed kafka message for chat message. Payload: ${messageValue}`)
        if (messageValue == null) {
            console.warn('kafka chat message is empty')
            return;
        }
        const msg: (CreateMessagePayload & {application_uuid: string, message_uuid: string, created_at: number, username: string}) = JSON.parse(messageValue);

        const channel = await ChannelRepository.findUserInChannel(
          msg.channel_uuid,
          msg.username,
          msg.application_uuid
        );
        const user = await UserRepository.findByUsernameAndAppUuid(
          msg.username,
          msg.application_uuid,
        );
        if (channel == null || user == null) {
            return;
        }



        const newMessage = new Message();

        if (msg.parent_message_uuid != null) {
            const parentMessage = await MessageRepository.findOneBy({uuid: msg.parent_message_uuid });
            if (parentMessage != null) {
                newMessage.parentMessage = parentMessage;
            }
        }

        newMessage.user = user;
        newMessage.channel = channel;
        newMessage.message =
          await RedisProfanityFilterRepository.maskBadWordsFromMessage(msg.message);
        newMessage.uuid = randomUUID();
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
        newMessage.createdBy = msg.username;
        newMessage.updatedBy = msg.username;


        await MessageRepository.save(newMessage);

        const possibleUrl = msg.message.match(URL_REGEX)?.[0];
        if (possibleUrl != null) {
            console.info(
              `Found url ${possibleUrl} in message ${newMessage.id}, queuing link preview`,
            );
            await KafkaMessageRepository.queueLinkPreview(newMessage.id, possibleUrl);
        }

        const response: MessageType = {
            uuid: newMessage.uuid,
            user: {
                username: user.username,
                nickname: user.nickname,
            },
            mentioned_users: [],
            channel_uuid: channel.uuid,
            message: newMessage.message,
            reactions: [],
            parent_message_uuid: newMessage.parentMessage?.uuid,
            attachments: await Promise.all(
              newMessage.attachments.map(async attachment => ({
                  original_file_name: attachment.original_file_name,
                  content_type: attachment.content_type,
                  download_signed_url: await AttachmentGcsRepository.signDownloadLink(
                    attachment.file_key,
                    attachment.original_file_name,
                  ),
              })),
            ),
            created_at: newMessage.createdAt.valueOf(),
            updated_at: newMessage.updatedAt.valueOf(),
        };

        await KafkaMessageRepository.sendMessage(response);

    }
}