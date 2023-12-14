import { DataSource } from 'typeorm';
import { Application } from '../entity/application.entity';
import { Channel } from '../entity/channel.entity';
import { ChannelUsers } from '../entity/channel-users.entity';
import { LinkPreview } from '../entity/link-preview.entity';
import { Message } from '../entity/message.entity';
import { Reaction } from '../entity/reaction.entity';
import { User } from '../entity/user.entity';

export const postgresqlDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DB,
  entities: [
    Application,
    Channel,
    ChannelUsers,
    LinkPreview,
    Message,
    Reaction,
    User,
    // 'src/entity/*.ts', 'build/entity/*.js'
  ],
  logging: false,
  synchronize: false,
});
