import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditingBaseEntity } from './base.entity';
import { Application } from './application.entity';
import { ChannelUsers } from './channel-users.entity';

@Entity()
export class User extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => Application)
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column()
  username: string;

  @Column()
  nickname: string;

  // @ManyToMany(type => Channel, channel => channel.users)
  // @JoinTable({ name: 'channel_users' , joinColumn: { name: 'user_id' }, inverseJoinColumn: { name: 'channel_id' }})
  // joinedChannels: Channel[];

  @OneToMany(type => ChannelUsers, channelUsers => channelUsers.user)
  // @JoinTable({ name: 'channel_users' , joinColumn: { name: 'user_id' }, inverseJoinColumn: { name: 'channel_id' }})
  channelUsers: ChannelUsers[];
}
