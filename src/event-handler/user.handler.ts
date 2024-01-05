import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { UserRepository } from '../repository/user.repository';
import { type User } from '../types/user';

export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
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

  socket.on('user:who-am-i', whoAmI);
};
