import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'game_results' })
export class GameResultEntity {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id: number;

  @Column({ name: 'game_id', type: 'varchar', length: 64 })
  gameId: string;

  @Column({ name: 'google_sub', type: 'varchar', length: 64 })
  googleSub: string;

  @Column({ name: 'score', type: 'int' })
  score: number;

  @Column({ name: 'rank', type: 'int' })
  rank: number;

  @Column({ name: 'created_at', type: 'datetime', nullable: true })
  createdAt?: Date;
}
