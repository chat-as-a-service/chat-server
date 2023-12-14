import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { ChannelRepository } from '../repository/channel.repository';
import { MessageRepository } from '../repository/message.repository';
import { Message } from '../entity/message.entity';
import { randomUUID } from 'crypto';
import {
  type CreateMessagePayload,
  type CreateMessageReplyPayload,
  type CreateMessageReplyResponse,
  type DeleteMessagePayload,
  type EditMessagePayload,
  type GetMessagePayload,
  type ListThreadPayload,
  type LoadNextMessagesPayload,
  type LoadNextMessagesResponse,
  type LoadPreviousMessagesPayload,
  type LoadPreviousMessagesResponse,
  type MessageType,
  type SearchMessagesPayload,
  type TypingIndicatorPayload,
} from '../types/message';
import { UserRepository } from '../repository/user.repository';
import { KafkaMessageRepository } from '../repository/message.kafka.repository';
import { ElasticsearchMessageRepository } from '../repository/message.es.repository';
import { postgresqlDataSource } from '../infrastructure/database';
import { AttachmentGcsRepository } from '../repository/attachment.gcs.repository';
import { RedisMessageRepository } from '../repository/message.redis.repository';
import { type CustomResponse } from '../types/common';
import { redisClient } from '../infrastructure/redis';

type CachedUser = { username: string; nickname: string };
export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
  const newMessage = async (
    msg: CreateMessagePayload,
    ack: (res: CustomResponse<MessageType>) => void,
  ): Promise<void> => {
    const createdAt = new Date();
    const channelRedisKey = `channel-member:${customSocket.application_uuid}:${msg.channel_uuid}`;
    const userRedisKey = `user:${customSocket.application_uuid}:${customSocket.username}`;

    let user: CachedUser | null = null;
    const userCache = await redisClient.get(userRedisKey);
    if (userCache == null) {
      const userEntity = await UserRepository.findByUsernameAndAppUuid(
        customSocket.username,
        customSocket.application_uuid,
      );
      if (userEntity == null) {
        ack({
          result: 'error',
          error_msg: 'user not found',
        });
        return;
      } else {
        user = {
          username: userEntity.username,
          nickname: userEntity.nickname,
        }
        await redisClient.set(userRedisKey, JSON.stringify(user));
      }
    }else {
      user = JSON.parse(userCache);
      if (user == null) {
        ack({
          result: 'error',
          error_msg: 'user not found',
        });
        return;
      }
    }


    const channelUserCache = await redisClient.hGet(
      channelRedisKey,
      customSocket.username,
    );
    if (channelUserCache == null) {
      const channelEntity = await ChannelRepository.findUserInChannel(
        msg.channel_uuid,
        customSocket.username,
        customSocket.application_uuid,
      );
      if (channelEntity == null) {
        ack({
          result: 'error',
          error_msg: 'channel not found',
        });
        return;
      } else {
        await redisClient.hSet(
          channelRedisKey,
          user.username,
          "true"
        );
      }
    }

    let parentMessage: Message | null = null;
    if (msg.parent_message_uuid != null) {
      parentMessage = await MessageRepository.findOneBy({
        uuid: msg.parent_message_uuid,
      });
      // if (parentMessage != null) {
      //   parentMessage = parentMessage;
      // }
      if (parentMessage == null) {
        ack({
          result: 'error',
          error_msg: 'parent message not found',
        });
        return;
      }
    }

    const newMsgUuid = randomUUID();
    const response: MessageType = {
      uuid: newMsgUuid,
      user: {
        username: user.username,
        nickname: user.nickname,
      },
      mentioned_users: [],
      channel_uuid: msg.channel_uuid,
      message: msg.message,
      reactions: [],
      parent_message_uuid: parentMessage?.uuid,
      attachments: await Promise.all(
        msg.attachments.map(async attachment => ({
          original_file_name: attachment.original_file_name,
          content_type: attachment.content_type,
          download_signed_url: await AttachmentGcsRepository.signDownloadLink(
            attachment.file_key,
            attachment.original_file_name,
          ),
        })),
      ),
      created_at: createdAt.valueOf(),
      updated_at: createdAt.valueOf(),
    };
    await KafkaMessageRepository.sendMessageSave({
      ...msg,
      application_uuid: customSocket.application_uuid,
      message_uuid: newMsgUuid,
      created_at: createdAt.valueOf(),
      username: user.username,
    });
    io.to(msg.channel_uuid).emit('message:new', response);

    ack({
      result: 'success',
      data: response,
    });
  };

  const newReply = async (
    payload: CreateMessageReplyPayload,
  ): Promise<void> => {
    const parentMessage = await MessageRepository.findOneBy({
      uuid: payload.parent_message_uuid,
    });
    if (parentMessage == null) {
      return;
    }
    const user = await UserRepository.findByUsernameAndAppUuid(
      customSocket.username,
      customSocket.application_uuid,
    );

    if (user == null) {
      return;
    }

    const channel = await ChannelRepository.findUserInChannel(
      payload.channel_uuid,
      customSocket.username,
      customSocket.application_uuid,
    );

    if (channel == null) {
      return;
    }
    const newMessage = new Message();
    newMessage.user = user;
    newMessage.channel = channel;
    newMessage.message = payload.message;
    newMessage.parentMessage = parentMessage;
    newMessage.uuid = randomUUID();

    newMessage.createdBy = user.username;
    newMessage.updatedBy = user.username;

    await MessageRepository.save(newMessage);

    const response: CreateMessageReplyResponse = {
      parent_message_uuid: parentMessage.uuid,
      channel_uuid: channel.uuid,
      reply_message: {
        uuid: newMessage.uuid,
        user: {
          username: user.username,
          nickname: user.nickname,
        },
        mention_type: newMessage.mentionType,
        mentioned_users: [],
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
        channel_uuid: channel.uuid,
        message: newMessage.message,
        reactions: [],
        created_at: newMessage.createdAt.valueOf(),
        updated_at: newMessage.updatedAt.valueOf(),
      },
    };

    io.to(channel.uuid).emit('message:new-reply', response);
  };

  const listThread = async (
    payload: ListThreadPayload,
    ack: (replies: CustomResponse<MessageType[]>) => void,
  ): Promise<void> => {
    const messageReplies = await MessageRepository.getMessageReplies(
      payload.message_uuid,
    );

    const channel = await ChannelRepository.findUserInChannel(
      payload.channel_uuid,
      customSocket.username,
      customSocket.application_uuid,
    );
    if (channel == null) {
      ack({
        result: 'error',
        error_msg: 'channel not found',
      });
      return;
    }

    const response: MessageType[] = await Promise.all(
      messageReplies.map(async message => {
        return {
          uuid: message.uuid,
          message: message.message,
          user: {
            username: message.user.username,
            nickname: message.user.nickname,
          },
          mentioned_users: [],
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
          created_at: message.createdAt.valueOf(),
          updated_at: message.updatedAt.valueOf(),
          channel_uuid: channel.uuid,
          reactions: message.reactions.map(reaction => {
            return {
              reaction: reaction.reaction,
              user: reaction.user,
              created_at: reaction.createdAt.valueOf(),
            };
          }),
        };
      }),
    );
    ack({
      result: 'success',
      data: response,
    });
  };

  const loadNextMessages = async (
    payload: LoadNextMessagesPayload,
    ack: (res: CustomResponse<LoadNextMessagesResponse>) => void,
  ): Promise<void> => {
    const next100Messages = await MessageRepository.getLatestMessagesInChannel(
      payload.channel_uuid,
      101,
    );

    // const messages = await Promise.all(
    //     next100Messages.map(async message => {
    //       const repliesByUserCnt = message.childMessages.reduce<
    //           Record<string, Message[]>
    //       >((acc, msg) => {
    //         if (!Object.prototype.hasOwnProperty.call(acc, msg.user.username)) {
    //           acc[msg.user.username] = [];
    //         }
    //         acc[msg.user.username].push(msg);
    //         return acc;
    //       }, {});
    //       const top5MostRepliedUsers = Object.entries(repliesByUserCnt)
    //           .sort((a, b) => b[1].length - a[1].length)
    //           .reverse()
    //           .slice(5)
    //           .map(([username, messages]) => messages[0].user);
    //
    //       const msg: MessageType = {
    //         uuid: message.uuid,
    //         message: message.message,
    //         user: {
    //           username: message.user.username,
    //           nickname: message.user.nickname,
    //         },
    //         mention_type: message.mentionType,
    //         mentioned_users: message.mentionedUsers.map(user => {
    //           return {
    //             username: user.username,
    //             nickname: user.nickname,
    //           };
    //         }),
    //         created_at: message.createdAt.valueOf(),
    //         updated_at: message.updatedAt.valueOf(),
    //         channel_uuid: message.channel.uuid,
    //         thread_info:
    //             message.childMessages.length > 0
    //                 ? {
    //                   reply_count: message.childMessages.length,
    //                   most_replies: top5MostRepliedUsers,
    //                   last_replied_at: message.childMessages
    //                       .sort(
    //                           (a, b) => b.createdAt.valueOf() - a.createdAt.valueOf(),
    //                       )[0]
    //                       .createdAt.valueOf(),
    //                   updated_at: message.updatedAt.valueOf(), // todo: update with real logic
    //                 }
    //                 : undefined,
    //         reactions: message.reactions.map(reaction => {
    //           return {
    //             reaction: reaction.reaction,
    //             user: reaction.user,
    //             created_at: reaction.createdAt.valueOf(),
    //           };
    //         }),
    //         attachments: await Promise.all(
    //             message.attachments.map(async attachment => ({
    //               original_file_name: attachment.original_file_name,
    //               content_type: attachment.content_type,
    //               download_signed_url:
    //                   await AttachmentGcsRepository.signDownloadLink(
    //                       attachment.file_key,
    //                       attachment.original_file_name,
    //                   ),
    //             })),
    //         ),
    //         og_tag:
    //             message.linkPreview != null
    //                 ? {
    //                   url: message.linkPreview.url,
    //                   title: message.linkPreview.title,
    //                   description: message.linkPreview.description,
    //                   image: message.linkPreview.imageLink,
    //                   image_width: message.linkPreview.imageWidth,
    //                   image_height: message.linkPreview.imageHeight,
    //                   image_alt: message.linkPreview.imageAlt,
    //                 }
    //                 : undefined,
    //       };
    //       return msg;
    //     }),
    // );
    //
    // ack({
    //   result: 'success',
    //   data: messages,
    // });
  };

  const loadPreviousMessages = async (
    payload: LoadPreviousMessagesPayload,
    ack: (res: CustomResponse<LoadPreviousMessagesResponse>) => void,
  ): Promise<void> => {
    if (
      payload.first_message_uuid == null &&
      payload.first_message_ts == null
    ) {
      ack({
        result: 'error',
        error_msg: 'first_message_uuid or first_message_ts must be provided',
      });
      return;
    }
    try {
      const previousMessages = await postgresqlDataSource.manager.transaction(
        async manager => {
          const messageRepository = manager.withRepository(MessageRepository);
          let firstMessage;
          if (payload.first_message_uuid) {
            firstMessage = await messageRepository.findOneBy({
              uuid: payload.first_message_uuid,
            });
            if (firstMessage == null) {
              throw new Error('message not found');
            }
          }

          return await messageRepository.getPreviousMessagesInChannel(
            payload.channel_uuid,
            101,
            firstMessage?.id,
            payload.first_message_ts != null
              ? new Date(payload.first_message_ts)
              : undefined,
          );
        },
      );

      const messages = await Promise.all(
        previousMessages
          .reverse()
          .filter((_, i) => {
            if (previousMessages.length > 100) {
              return i > 0;
            }
            return true;
          })
          .map(async message => {
            const repliesByUserCnt = message.childMessages.reduce<
              Record<string, Message[]>
            >((acc, msg) => {
              if (
                !Object.prototype.hasOwnProperty.call(acc, msg.user.username)
              ) {
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
                          (a, b) =>
                            b.createdAt.valueOf() - a.createdAt.valueOf(),
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
        data: {
          messages,
          has_previous: previousMessages.length === 101,
        },
      });
    } catch (e) {
      console.error(e);
      ack({
        result: 'error',
      });
    }
  };

  const searchMessages = async (
    payload: SearchMessagesPayload,
    ack: (response: unknown) => void,
  ): Promise<void> => {
    const searchHits = await ElasticsearchMessageRepository.searchMessages(
      payload.search_string,
    );
    ack(searchHits.hits.hits.map(hit => hit._source));
  };

  const deleteMessage = async (
    payload: DeleteMessagePayload,
  ): Promise<void> => {
    const message = await MessageRepository.getMessage(
      customSocket.application_uuid,
      payload.channel_uuid,
      payload.message_uuid,
      customSocket.username,
    );
    if (message == null) {
      console.log(
        `user ${customSocket.username} tried to delete message ${payload.message_uuid} but it does not exist`,
      );
      return;
    }
    await MessageRepository.delete({ id: message.id });
    io.emit('message:deleted', message.uuid);
  };

  const editMessage = async (
    payload: EditMessagePayload,
    ack: () => void,
  ): Promise<void> => {
    const updatedMessageEntity = await postgresqlDataSource.manager.transaction(
      async manager => {
        const messageRepository = manager.withRepository(MessageRepository);
        const message = await messageRepository.getMessage(
          customSocket.application_uuid,
          payload.channel_uuid,
          payload.message_uuid,
          customSocket.username,
        );
        if (message == null) {
          console.log(
            `user ${customSocket.username} tried to edit message ${payload.message_uuid} but it does not exist`,
          );
          return;
        }
        message.message = payload.new_message;
        message.updatedAt = new Date();
        await messageRepository.save(message);

        return await messageRepository.getFullMessage(
          customSocket.application_uuid,
          payload.channel_uuid,
          payload.message_uuid,
        );
      },
    );
    if (updatedMessageEntity == null) {
      console.error('updated message entity is null');
      return;
    }

    const repliesByUserCnt = updatedMessageEntity.childMessages.reduce<
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

    const response: MessageType = {
      uuid: updatedMessageEntity.uuid,
      message: updatedMessageEntity.message,
      user: {
        username: updatedMessageEntity.user.username,
        nickname: updatedMessageEntity.user.nickname,
      },
      mention_type: updatedMessageEntity.mentionType,
      mentioned_users: updatedMessageEntity.mentionedUsers.map(user => {
        return {
          username: user.username,
          nickname: user.nickname,
        };
      }),
      attachments: await Promise.all(
        updatedMessageEntity.attachments.map(async attachment => ({
          original_file_name: attachment.original_file_name,
          content_type: attachment.content_type,
          download_signed_url: await AttachmentGcsRepository.signDownloadLink(
            attachment.file_key,
            attachment.original_file_name,
          ),
        })),
      ),
      thread_info:
        updatedMessageEntity.childMessages.length > 0
          ? {
              reply_count: updatedMessageEntity.childMessages.length,
              most_replies: top5MostRepliedUsers,
              last_replied_at: updatedMessageEntity.childMessages
                .sort(
                  (a, b) => b.createdAt.valueOf() - a.createdAt.valueOf(),
                )[0]
                .createdAt.valueOf(),
              updated_at: updatedMessageEntity.updatedAt.valueOf(), // todo: update with real logic
            }
          : undefined,
      og_tag:
        updatedMessageEntity.linkPreview != null
          ? {
              url: updatedMessageEntity.linkPreview.url,
              title: updatedMessageEntity.linkPreview.title,
              description: updatedMessageEntity.linkPreview.description,
              image: updatedMessageEntity.linkPreview.imageLink,
              image_width: updatedMessageEntity.linkPreview.imageWidth,
              image_height: updatedMessageEntity.linkPreview.imageHeight,
              image_alt: updatedMessageEntity.linkPreview.imageAlt,
            }
          : undefined,
      created_at: updatedMessageEntity.createdAt.valueOf(),
      updated_at: updatedMessageEntity.updatedAt.valueOf(),
      channel_uuid: updatedMessageEntity.channel.uuid,
      reactions: updatedMessageEntity.reactions.map(reaction => {
        return {
          reaction: reaction.reaction,
          user: reaction.user,
          created_at: reaction.createdAt.valueOf(),
        };
      }),
    };

    io.emit('message:updated', response);
    ack();
  };

  const handleTyping = async (
    payload: TypingIndicatorPayload,
  ): Promise<void> => {
    const user = await UserRepository.findByUsernameAndAppUuid(
      customSocket.username,
      customSocket.application_uuid,
    );
    if (user == null) {
      console.warn(
        `user ${customSocket.username} tried to send typing indicator but user does not exist`,
      );
      return;
    }
    await RedisMessageRepository.setTypingIndicator(
      {
        username: user.username,
        nickname: user.nickname,
      },
      payload.channel_uuid,
    );
    const typingUsers = await RedisMessageRepository.listUsersTypingInChannel(
      payload.channel_uuid,
    );
    io.to(payload.channel_uuid).emit(
      'message:typing-users-refresh',
      typingUsers,
    );
  };

  const handleTypingEnd = async (
    payload: TypingIndicatorPayload,
  ): Promise<void> => {
    const user = await UserRepository.findByUsernameAndAppUuid(
      customSocket.username,
      customSocket.application_uuid,
    );
    if (user == null) {
      console.warn(
        `user ${customSocket.username} tried to send typing indicator but user does not exist`,
      );
      return;
    }
    await RedisMessageRepository.deleteTypingIndicator(
      {
        username: user.username,
        nickname: user.nickname,
      },
      payload.channel_uuid,
    );
    const typingUsers = await RedisMessageRepository.listUsersTypingInChannel(
      payload.channel_uuid,
    );
    io.to(payload.channel_uuid).emit(
      'message:typing-users-refresh',
      typingUsers,
    );
  };

  const getMessage = async (
    payload: GetMessagePayload,
    ack: (res: CustomResponse<MessageType>) => void,
  ): Promise<void> => {
    const message = await MessageRepository.getFullMessage(
      customSocket.application_uuid,
      payload.channel_uuid,
      payload.message_uuid,
    );
    if (message == null) {
      ack({
        result: 'error',
        error_msg: 'message not found',
      });
      return;
    }
    const messageResponse: MessageType = {
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
    ack({
      result: 'success',
      data: messageResponse,
    });
  };

  socket.on('message:create', newMessage);
  socket.on('message:create-reply', newReply);
  socket.on('message:load-next', loadNextMessages);
  socket.on('message:load-previous', loadPreviousMessages);
  socket.on('message:list-thread', listThread);
  socket.on('message:search', searchMessages);
  socket.on('message:delete', deleteMessage);
  socket.on('message:edit', editMessage);
  socket.on('message:get', getMessage);
  socket.on('message:typing-start', handleTyping);
  socket.on('message:typing-end', handleTypingEnd);
};
