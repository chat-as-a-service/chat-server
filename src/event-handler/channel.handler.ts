import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { ChannelRepository } from '../repository/channel.repository';
import { MessageRepository } from '../repository/message.repository';
import { type MessageType } from '../types/message';
import { type Message } from '../entity/message.entity';
import { AttachmentGcsRepository } from '../repository/attachment.gcs.repository';
import { ChannelListRes, ChannelType } from '../types/channel';
import { CustomResponse } from '../types/common';
import { postgresqlDataSource } from '../infrastructure/database';
import { UserRepository } from '../repository/user.repository';
import { ChannelUsers } from '../entity/channel-users.entity';
import { Channel } from '../entity/channel.entity';

export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
  const joinChannel = async (
    channelUuid: string,
    ack: (response: CustomResponse<MessageType[]>) => void,
  ): Promise<void> => {
    let channel: Channel;
    try {
      channel = await postgresqlDataSource.manager.transaction(
        async manager => {
          const channelRepository = manager.withRepository(ChannelRepository);
          const userRepository = manager.withRepository(UserRepository);
          const channel = await channelRepository.findChannelByUuid(
            customSocket.application_uuid,
            channelUuid,
          );
          const user = await userRepository.findByUsernameAndAppUuid(
            customSocket.username,
            customSocket.application_uuid,
          );

          if (channel == null) {
            throw new Error(`channel ${channelUuid} does not exist`);
          }
          if (user == null) {
            throw new Error(`user ${customSocket.username} does not exist`);
          }
          const channelWithUser = await ChannelRepository.findUserInChannel(
            channelUuid,
            customSocket.username,
            customSocket.application_uuid,
          );
          if (channelWithUser == null) {
            console.log(
              `user ${customSocket.username} does not exist in channel ${channelUuid}. Adding user to channel.`,
            );
            const now = new Date();
            const channelUser = new ChannelUsers();
            channelUser.channel = channel;
            channelUser.user = user;
            channelUser.createdBy = user.username;
            channelUser.createdAt = now;
            channelUser.updatedBy = user.username;
            channelUser.updatedAt = now;
            await manager.save(channelUser);
          }
          return channel;
        },
      );
    } catch (err) {
      console.error(err);
      ack({
        result: 'error',
        error_msg: (err as Error).message,
      });
      return;
    }

    await socket.join(channel.uuid);
    console.log(`user ${socket.id} joined channel ${channelUuid}`);
    const recent100Messages =
      await MessageRepository.getLatestMessagesInChannel(channelUuid, 100);

    const messages = await Promise.all(
      recent100Messages.map(async message => {
        const repliesByUserCnt = message.childMessages.reduce<
          Record<string, Message[]>
        >((acc, msg) => {
          if (!Object.prototype.hasOwnProperty.call(acc, msg.user.username)) {
            acc[msg.user.username] = [];
          }
          acc[msg.user.username].push(msg);
          return acc;
        }, {});
        const top5MostRepliedUsers = Object.entries(repliesByUserCnt)
          .sort((a, b) => b[1].length - a[1].length)
          .reverse()
          .slice(5)
          .map(([username, messages]) => messages[0].user);

        const msg: MessageType = {
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
          created_at: message.createdAt.valueOf(),
          updated_at: message.updatedAt.valueOf(),
          channel_uuid: message.channel.uuid,
          thread_info:
            message.childMessages.length > 0
              ? {
                  reply_count: message.childMessages.length,
                  most_replies: top5MostRepliedUsers,
                  last_replied_at: message.childMessages
                    .sort(
                      (a, b) => b.createdAt.valueOf() - a.createdAt.valueOf(),
                    )[0]
                    .createdAt.valueOf(),
                  updated_at: message.updatedAt.valueOf(), // todo: update with real logic
                }
              : undefined,
          reactions: message.reactions.map(reaction => {
            return {
              reaction: reaction.reaction,
              user: reaction.user,
              created_at: reaction.createdAt.valueOf(),
            };
          }),
          attachments: await Promise.all(
            message.attachments.map(async attachment => ({
              original_file_name: attachment.original_file_name,
              content_type: attachment.content_type,
              download_signed_url:
                await AttachmentGcsRepository.signDownloadLink(
                  attachment.file_key,
                  attachment.original_file_name,
                ),
            })),
          ),
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
        };
        return msg;
      }),
    );

    ack({
      result: 'success',
      data: messages,
    });
  };

  const getChannel = async (
    channelUuid: string,
    ack: (response: CustomResponse<ChannelType>) => void,
  ): Promise<void> => {
    const channel = await ChannelRepository.findChannelByUuid(
      customSocket.application_uuid,
      channelUuid,
    );
    if (channel == null) {
      console.error(`channel ${channelUuid} does not exist}`);
      ack({
        result: 'error',
        error_msg: `channel ${channelUuid} does not exist`,
      });
      return;
    }
    const channelResponse: ChannelType = {
      uuid: channel.uuid,
      name: channel.name,
      created_at: channel.createdAt.valueOf(),
      updated_at: channel.updatedAt.valueOf(),
    };
    ack({
      result: 'success',
      data: channelResponse,
    });
  };

  const listChannels = async (
    ack: (res: CustomResponse<ChannelListRes[]>) => void,
  ) => {
    const channels = await ChannelRepository.listChannels(
      customSocket.application_uuid,
    );
    ack({
      result: 'success',
      data: channels.map(channel => ({
        uuid: channel.uuid,
        name: channel.name,
        user_count: channel.userCount!,
        max_members: channel.maxMembers,
        created_at: channel.createdAt.valueOf(),
        updated_at: channel.updatedAt.valueOf(),
      })),
    });
  };

  socket.on('channel:join', joinChannel);
  socket.on('channel:get', getChannel);
  socket.on('channel:list', listChannels);
};
