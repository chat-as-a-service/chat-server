import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { User } from '../entity/user.entity';

export const UserRepository = dataSource.getRepository(User).extend({
  async findByUsernameAndAppUuid(username: string, applicationUuid: string) {
    return await this.createQueryBuilder('user')
      .innerJoin('user.application', 'application')
      .where('user.username = :username', { username })
      .andWhere('application.uuid = :applicationUuid', { applicationUuid })
      .getOne();
  },

  async findUsersByUsername(usernames: string[]) {
    return await this.createQueryBuilder('user')
      .where('user.username IN (:...usernames)', { usernames })
      .getMany();
  },

  async listUsersInChannel(channelUuid: string, appUuid: string) {
    return await this.createQueryBuilder('user')
      .leftJoinAndSelect('user.joinedChannels', 'channel')
      .leftJoinAndSelect('channel.application', 'application')
      .where('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('application.uuid = :appUuid', { appUuid })
      .getMany();
  },
});
