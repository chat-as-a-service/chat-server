import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { Message } from '../entity/message.entity';

export const MessageRepository = dataSource.getRepository(Message).extend({
  async getLatestMessagesInChannel(channelUuid: string, count: number) {
    return await this.createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('message.channel', 'channel')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .leftJoinAndSelect('reaction.user', 'reactionUser')
      .leftJoinAndSelect('message.linkPreview', 'linkPreview')
      .leftJoinAndSelect('message.mentionedUsers', 'mentionedUsers')
      .leftJoinAndSelect('message.childMessages', 'childMessages')
      .leftJoinAndSelect('childMessages.user', 'childMessageUser')
      .where('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('message.parentMessage IS NULL')
      .orderBy('message.createdAt', 'ASC')
      .limit(count)
      .getMany();
  },

  async getPreviousMessagesInChannel(
    channelUuid: string,
    count: number,
    beforeThisMsgId?: number,
    beforeThisDate?: Date,
  ) {
    let query = this.createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('message.channel', 'channel')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .leftJoinAndSelect('reaction.user', 'reactionUser')
      .leftJoinAndSelect('message.linkPreview', 'linkPreview')
      .leftJoinAndSelect('message.mentionedUsers', 'mentionedUsers')
      .leftJoinAndSelect('message.childMessages', 'childMessages')
      .leftJoinAndSelect('childMessages.user', 'childMessageUser')
      .loadRelationCountAndMap('message.repliesCount', 'message.childMessages')
      .where('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('message.parentMessage IS NULL');

    if (beforeThisMsgId != null) {
      query = query.andWhere('message.id < :beforeThisMsgId', {
        beforeThisMsgId,
      });
    } else {
      query = query.andWhere('message.createdAt < :beforeThisTs', {
        beforeThisTs: beforeThisDate,
      });
    }

    return await query
      .orderBy('message.createdAt', 'DESC')
      .limit(count)
      .getMany();
  },

  async getMessagesReplyCount(channelUuid: string, message_ids: number[]) {
    return await this.createQueryBuilder('message')
      .leftJoinAndSelect('message.childMessages', 'childMessages')
      .leftJoinAndSelect('childMessages.user', 'childMessageUser')
      .loadRelationCountAndMap('message.repliesCount', 'message.childMessages')
      .leftJoinAndSelect(
        qb =>
          qb
            .select(
              '(replies.id) as replyId, COUNT(replies.id) as repliesCount',
            )
            .from(Message, 'replies')
            .leftJoin('replies.user', 'replyUser')
            .groupBy('replies.id')
            .addGroupBy('replyUser.id')
            .orderBy('repliesCount', 'DESC')
            .limit(5),
        'top5RepliedUsers',
        'replyId = message.id',
      )
      .where('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('message.parentMessage IN :message_ids', { message_ids })
      .getRawMany();
  },

  async getMessageReplies(messageUuid: string) {
    return await this.createQueryBuilder('message')
      .leftJoinAndSelect('message.parentMessage', 'parentMessage')
      .leftJoinAndSelect('message.user', 'user')
      .where('parentMessage.uuid = :messageUuid', { messageUuid })
      .leftJoinAndSelect('message.reactions', 'reaction')
      .orderBy('message.createdAt', 'ASC')
      .getMany();
  },

  async getMessage(
    appUuid: string,
    channelUuid: string,
    messageUuid: string,
    username: string,
  ) {
    return await this.createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('message.channel', 'channel')
      .leftJoinAndSelect('channel.application', 'application')
      .where('application.uuid = :appUuid', { appUuid })
      .andWhere('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('message.uuid = :messageUuid', { messageUuid })
      .andWhere('user.username = :username', { username })
      .getOne();
  },

  async getFullMessage(
    appUuid: string,
    channelUuid: string,
    messageUuid: string,
  ) {
    return await this.createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('message.channel', 'channel')
      .leftJoinAndSelect('channel.application', 'application')
      .leftJoinAndSelect('message.reactions', 'reaction')
      .leftJoinAndSelect('reaction.user', 'reactionUser')
      .leftJoinAndSelect('message.linkPreview', 'linkPreview')
      .leftJoinAndSelect('message.mentionedUsers', 'mentionedUsers')
      .leftJoinAndSelect('message.childMessages', 'childMessages')
      .leftJoinAndSelect('childMessages.reactions', 'childMessageReactions')
      .where('application.uuid = :appUuid', { appUuid })
      .andWhere('channel.uuid = :channelUuid', { channelUuid })
      .andWhere('message.uuid = :messageUuid', { messageUuid })
      .getOne();
  },
});
