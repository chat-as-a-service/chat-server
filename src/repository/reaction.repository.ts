import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { Reaction } from '../entity/reaction.entity';

export const ReactionRepository = dataSource.getRepository(Reaction).extend({
  async findByMessageAndReaction(
    messageId: number,
    reaction: string,
    username: string,
  ) {
    return await this.createQueryBuilder('reaction')
      .leftJoin('reaction.user', 'user')
      .where('reaction.reaction = :reaction', { reaction })
      .andWhere('reaction.message.id = :messageId', { messageId })
      .andWhere('user.username = :username', { username })
      .getOne();
  },

  async findByMessage(messageId: number) {
    return await this.createQueryBuilder('reaction')
      .leftJoinAndSelect('reaction.user', 'user')
      .where('reaction.message.id = :messageId', { messageId })
      .getMany();
  },
});
