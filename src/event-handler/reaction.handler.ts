import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { ChannelRepository } from '../repository/channel.repository';
import { MessageRepository } from '../repository/message.repository';
import { UserRepository } from '../repository/user.repository';
import { postgresqlDataSource } from '../infrastructure/database';
import { Reaction } from '../entity/reaction.entity';
import {
  ReactionPayload,
  UpdateMessageReactionPayload,
} from '../types/reaction';
import { ReactionRepository } from '../repository/reaction.repository';

export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
  const newReaction = async (payload: ReactionPayload): Promise<void> => {
    await postgresqlDataSource.manager.transaction(async manager => {
      const channel = await manager
        .withRepository(ChannelRepository)
        .findUserInChannel(
          payload.channel_uuid,
          customSocket.username,
          customSocket.application_uuid,
        );
      if (channel == null) return;

      const message = await manager
        .withRepository(MessageRepository)
        .findOneBy({
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
      if (existingReaction == null) {
        const newReaction = new Reaction();
        newReaction.message = message;
        newReaction.reaction = payload.reaction;
        newReaction.user = user;
        newReaction.createdBy = user.username;
        newReaction.updatedBy = user.username;

        await manager.save(newReaction);
      } else {
        await manager.delete(Reaction, existingReaction.id);
      }

      const messageReactions = await reactionRepository.findByMessage(
        message.id,
      );

      const emitPayload: UpdateMessageReactionPayload = {
        message_uuid: message.uuid,
        reactions: messageReactions.map(reaction => {
          return {
            reaction: reaction.reaction,
            user: {
              username: reaction.user.username,
              nickname: reaction.user.nickname,
            },
            created_at: reaction.createdAt.valueOf(),
          };
        }),
      };
      io.to(channel.uuid).emit('message:update-reactions', emitPayload);
    });
  };

  socket.on('reaction:create-or-delete', newReaction);
};
