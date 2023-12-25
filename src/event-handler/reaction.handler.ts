import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { ChannelRepository } from '../repository/channel.repository';
import { MessageRepository } from '../repository/message.repository';
import { UserRepository } from '../repository/user.repository';
import { postgresqlDataSource } from '../infrastructure/database';
import { Reaction } from '../entity/reaction.entity';
import { type ReactionPayload } from '../types/reaction';
import { ReactionRepository } from '../repository/reaction.repository';
import { type MessageType } from '../types/message';
import { AttachmentGcsRepository } from '../repository/attachment.gcs.repository';

export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
  const newReaction = async (payload: ReactionPayload): Promise<void> => {
    console.log('newReaction', payload);
    await postgresqlDataSource.manager.transaction(async manager => {
      const channel = await manager
        .withRepository(ChannelRepository)
        .findUserInChannel(
          payload.channel_uuid,
          customSocket.username,
          customSocket.application_uuid,
        );
      if (channel == null) return;

      const messageRepository = manager.withRepository(MessageRepository);
      let message = await messageRepository.findOneBy({
        uuid: payload.message_uuid,
      });
      if (message == null) {
        return;
      }
      const user = await manager
        .withRepository(UserRepository)
        .findByUsernameAndAppUuid(
          customSocket.username,
          customSocket.application_uuid,
        );
      if (user == null) {
        return;
      }
      const reactionRepository = manager.withRepository(ReactionRepository);
      const existingReaction =
        await reactionRepository.findByMessageAndReaction(
          message.id,
          payload.reaction,
          customSocket.username,
        );
      if (existingReaction == null && payload.op === 'add') {
        const newReaction = new Reaction();
        const createdAt = new Date();
        newReaction.message = message;
        newReaction.reaction = payload.reaction;
        newReaction.user = user;
        newReaction.createdBy = user.username;
        newReaction.createdAt = createdAt;
        newReaction.updatedBy = user.username;
        newReaction.updatedAt = createdAt;

        await manager.save(newReaction);
      } else if (existingReaction == null && payload.op === 'delete') {
        // do nothing
      } else if (existingReaction != null && payload.op === 'add') {
        existingReaction.updatedBy = user.username;
        existingReaction.updatedAt = new Date();
        await manager.save(existingReaction);
      } else if (existingReaction != null && payload.op === 'delete') {
        await manager.delete(Reaction, existingReaction.id);
      }

      message = await messageRepository.getFullMessage(
        customSocket.application_uuid,
        payload.channel_uuid,
        payload.message_uuid,
      );
      if (message == null) {
        console.error('message not found');
        return;
      }
      const response: MessageType = {
        uuid: message.uuid,
        message: message.message,
        user: {
          username: message.user.username,
          nickname: message.user.nickname,
        },
        mention_type: message.mentionType,
        mentioned_users: message.mentionedUsers.map(user => {
          return {
            username: user.username,
            nickname: user.nickname,
          };
        }),
        attachments: await Promise.all(
          message.attachments.map(async attachment => ({
            original_file_name: attachment.original_file_name,
            content_type: attachment.content_type,
            download_signed_url: await AttachmentGcsRepository.signDownloadLink(
              attachment.file_key,
              attachment.original_file_name,
            ),
          })),
        ),
        thread_info:
          message.childMessages.length > 0
            ? {
                reply_count: message.childMessages.length,
                last_replied_at: message.childMessages
                  .sort(
                    (a, b) => b.createdAt.valueOf() - a.createdAt.valueOf(),
                  )[0]
                  .createdAt.valueOf(),
                updated_at: message.updatedAt.valueOf(), // todo: update with real logic
                most_replies: [],
              }
            : undefined,
        og_tag:
          message.linkPreview != null
            ? {
                url: message.linkPreview.url,
                title: message.linkPreview.title,
                description: message.linkPreview.description,
                image: message.linkPreview.imageLink,
                image_width: message.linkPreview.imageWidth,
                image_height: message.linkPreview.imageHeight,
                image_alt: message.linkPreview.imageAlt,
              }
            : undefined,
        created_at: message.createdAt.valueOf(),
        updated_at: message.updatedAt.valueOf(),
        channel_uuid: message.channel.uuid,
        reactions: message.reactions.map(reaction => {
          return {
            reaction: reaction.reaction,
            user: reaction.user,
            created_at: reaction.createdAt.valueOf(),
          };
        }),
      };

      io.to(channel.uuid).emit('message:updated', response);
    });
  };

  socket.on('reaction:create-or-delete', newReaction);
};
