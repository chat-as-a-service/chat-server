import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  @Column({ name: 'is_online' })
  isOnline: boolean;

  @Column({ name: 'is_operator' })
  isOperator: boolean;

  @Column({
    name: 'last_seen_at',
    type: 'timestamp with time zone',
    nullable: tru,
  })
  lastSeenAt?: Date;
}
