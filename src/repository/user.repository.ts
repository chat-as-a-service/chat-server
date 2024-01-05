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
});
