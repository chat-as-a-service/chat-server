import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { ChannelUsers } from '../entity/channel-users.entity';
import { type ChannelMemberListOrder } from '../types/channel';
import { type z } from 'zod';

export const ChannelUsersRepository = dataSource
  .getRepository(ChannelUsers)
  .extend({
    async listUsersInChannel(
      channelUuid: string,
      order: z.infer<typeof ChannelMemberListOrder>,
      limit: number,
      token: number,
    ) {
      let query = this.createQueryBuilder('cu')
        .leftJoinAndSelect('cu.user', 'user')
        .leftJoinAndSelect('cu.channel', 'channel')
        .where('channel.uuid = :channelUuid', { channelUuid })
        .andWhere('cu.id > :token', { token });

      if (order === 'OPERATOR_THEN_MEMBER_ALPHABETICAL') {
        query = query.orderBy('cu.isOperator', 'DESC');
      }
      query = query.addOrderBy('user.nickname', 'ASC');

      return await query.limit(limit).getMany();
    },

    async markUserAsOfflineForAllOnlineChannels(userId: number) {
      return await this.createQueryBuilder()
        .update()
        .where('user.id = :userId', { userId })
        .andWhere('isOnline = :isOnline', { isOnline: true })
        .set({ isOnline: false, lastSeenAt: new Date() })
        .execute();
    },

    async updateLastSeenAtForAllOnlineChannels(userId: number) {
      return await this.createQueryBuilder()
        .update()
        .where('user.id = :userId', { userId })
        .andWhere('isOnline = :isOnline', { isOnline: true })
        .set({ lastSeenAt: new Date() })
        .execute();
    },
  });
