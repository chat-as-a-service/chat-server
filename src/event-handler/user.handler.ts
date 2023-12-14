import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { UserRepository } from '../repository/user.repository';
import { ListUsersInChannelPayload, User } from '../types/user';

export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
  const listUsersInChannel = async (
    payload: ListUsersInChannelPayload,
    ack: (users: User[]) => void,
  ): Promise<void> => {
    const usersInChannel = await UserRepository.listUsersInChannel(
      payload.channel_uuid,
      customSocket.application_uuid,
    );
    const response = usersInChannel.map(user => {
      return {
        username: user.username,
        nickname: user.nickname,
      };
    });
    ack(response);
  };

  const whoAmI = async (ack: (user: User) => void): Promise<void> => {
    const user = await UserRepository.findByUsernameAndAppUuid(
      customSocket.username,
      customSocket.application_uuid,
    );
    if (user == null) {
      return;
    }
    ack({
      username: user.username,
      nickname: user.nickname,
    });
  };

  socket.on('user:list-users-in-channel', listUsersInChannel);
  socket.on('user:who-am-i', whoAmI);
};
