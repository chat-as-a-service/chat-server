import {
  Column,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditingBaseEntity } from './base.entity';
import { Application } from './application.entity';
import { ChannelUsers } from './channel-users.entity';

@Entity()
export class Channel extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'uuid', type: 'uuid' })
  @Generated('uuid')
  uuid: string;

  @ManyToOne(type => Application)
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column()
  name: string;

  @Column({ name: 'max_members' })
  maxMembers: number;

  // @ManyToMany(type => User, user => user.channelUsers)
  // @JoinTable({ name: 'channel_users', joinColumn: { name: 'channel_id' }, inverseJoinColumn: { name: 'user_id' } })
  @OneToMany(type => ChannelUsers, channelUsers => channelUsers.channel)
  users: ChannelUsers[];

  userCount?: number;
}
