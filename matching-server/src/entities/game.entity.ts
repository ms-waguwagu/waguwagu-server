import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'games' })
export class GameEntity {
  @PrimaryColumn({ name: 'game_id', type: 'varchar', length: 64 })
  gameId: string;

  @Column({ name: 'room_id', type: 'varchar', length: 64 })
  roomId: string;

  @Column({ name: 'ended_at', type: 'datetime' })
  endedAt: Date;
}
