import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { AuditingBaseEntity } from './base.entity';

@Entity()
export class Message extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'channel_id' })
  channelId: number;

  @Column()
  message: string;
}
