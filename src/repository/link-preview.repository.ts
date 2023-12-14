import { postgresqlDataSource as dataSource } from '../infrastructure/database';
import { LinkPreview } from '../entity/link-preview.entity';

export const LinkPreviewRepository = dataSource
  .getRepository(LinkPreview)
  .extend({});
