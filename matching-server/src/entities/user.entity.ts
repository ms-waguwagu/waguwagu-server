import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ name: 'google_sub', type: 'varchar', length: 64 })
  googleSub: string;

  @Column({ name: 'nickname', type: 'varchar', length: 32 })
  nickname: string;

  @Column({ name: 'created_at', type: 'datetime', nullable: true })
  createdAt?: Date;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt?: Date;
}
