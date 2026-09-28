import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

// personId points at a Person workspace-entity, which lives in the
// workspace's own Postgres schema, not in `core` — there is no FK here,
// it's resolved through the workspace datasource at query time.
@Entity({ name: 'portalAccess', schema: 'core' })
@Unique('IDX_PORTAL_ACCESS_WORKSPACE_ID_EMAIL_UNIQUE', [
  'workspaceId',
  'email',
])
export class PortalAccessEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  personId: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
