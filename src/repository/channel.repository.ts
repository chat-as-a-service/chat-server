import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { Channel } from '../entity/channel.entity';

export const ChannelRepository = dataSource.getRepository(Channel).extend({
  async findUserInChannel(
    channelUuid: string,
    username: string,
    appUuid: string,
  ) {
    return await this.createQueryBuilder('channel')
      .innerJoin('channel.users', 'channelUsers')
      .innerJoin('channelUsers.user', 'user')
      .innerJoin('channel.application', 'application')
      .where('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('application.uuid = :appUuid', { appUuid })
      .andWhere('user.username = :username', { username })
      .getOne();
  },

  async findChannelByUuid(appUuid: string, channelUuid: string) {
    return await this.createQueryBuilder('channel')
      .innerJoin('channel.application', 'application')
      .where('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('application.uuid = :appUuid', { appUuid })
      .getOne();
  },

  async listChannels(appUuid: string) {
    return await this.createQueryBuilder('channel')
      .leftJoinAndSelect('channel.application', 'application')
      .loadRelationCountAndMap('channel.userCount', 'channel.users')
      .where('application.uuid = :appUuid', { appUuid })
      .orderBy('channel.createdAt', 'DESC')
      .getMany();
  },
});
