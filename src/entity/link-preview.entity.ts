import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuditingBaseEntity } from './base.entity';

@Entity()
export class LinkPreview extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  url: string;

  @Column({ nullable: false })
  title: string;

  @Column()
  description?: string;

  @Column({ name: 'image_link' })
  imageLink?: string;

  @Column({ name: 'image_width' })
  imageWidth?: number;

  @Column({ name: 'image_height' })
  imageHeight?: number;

  @Column({ name: 'image_alt' })
  imageAlt?: string;
}
