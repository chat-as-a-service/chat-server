import { Column, Entity, Generated, PrimaryGeneratedColumn } from 'typeorm';
import { AuditingBaseEntity } from './base.entity';

@Entity()
export class Application extends AuditingBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'uuid', type: 'uuid' })
  @Generated('uuid')
  uuid: string;

  @Column()
  name: string;

  @Column({ name: 'organization_id' })
  organizationId: number;

  @Column({ name: 'master_api_token' })
  masterApiToken: string;
}
