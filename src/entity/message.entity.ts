import {
  Column,
  Entity,
  Generated,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditingBaseEntity } from './base.entity';
import { Reaction } from './reaction.entity';
import { Channel } from './channel.entity';
import { User } from './user.entity';
import { MentionType } from '../types/message';
import { LinkPreview } from './link-preview.entity';
import { AttachmentEntity } from '../types/attachment';

@Entity()
export class Message extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'uuid', type: 'uuid' })
  @Generated('uuid')
  uuid: string;

  @ManyToOne(type => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(type => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column()
  message: string;

  @OneToMany(type => Reaction, reaction => reaction.message)
  reactions: Reaction[];

  @ManyToOne(type => Message, message => message.childMessages, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage?: Message;

  @OneToMany(type => Message, message => message.parentMessage)
  childMessages: Message[];

  @ManyToMany(type => User)
  @JoinTable({
    name: 'message_user_mentions',
    joinColumn: { name: 'message_id' },
    inverseJoinColumn: { name: 'user_id' },
  })
  mentionedUsers: User[];

  @Column({ name: 'mention_type', nullable: true })
  mentionType?: MentionType;

  @ManyToOne(type => LinkPreview, { nullable: true })
  @JoinColumn({ name: 'link_preview_id' })
  linkPreview?: LinkPreview;

  @Column({
    type: 'jsonb',
    array: true,
    default: () => "'[]'::jsonb",
    nullable: false,
  })
  attachments: AttachmentEntity[];
}
