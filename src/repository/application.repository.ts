import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { Application } from '../entity/application.entity';

export const ApplicationRepository = dataSource
  .getRepository(Application)
  .extend({
    async findByUuid(appUuid: string) {
      return await this.createQueryBuilder('application')
        .where('application.uuid = :appUuid', { appUuid })
        .getOne();
    },
  });
