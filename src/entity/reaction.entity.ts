import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditingBaseEntity } from './base.entity';
import { Message } from './message.entity';
import { User } from './user.entity';

@Entity()
export class Reaction extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => Message)
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(type => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 30, nullable: false })
  reaction: string;
}
