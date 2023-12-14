import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AuditingBaseEntity } from './base.entity';
import { User } from './user.entity';
import { Channel } from './channel.entity';

@Entity()
export class ChannelUsers extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => User, user => user.channelUsers)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(type => Channel, channel => channel.users)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;
}
