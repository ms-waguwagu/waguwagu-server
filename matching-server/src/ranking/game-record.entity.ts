import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('game_record')
@Index(['roomId', 'userId'], { unique: true })
export class GameRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 36 })
  roomId: string;

  @Column({ length: 64 })
  userId: string;

  @Column({ length: 50 })
  nickname: string;

  @Column()
  score: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  playedAt: Date;
}
