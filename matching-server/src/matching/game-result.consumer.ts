import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { DataSource } from 'typeorm';

@Injectable()
export class GameResultConsumer {
  private readonly logger = new Logger(GameResultConsumer.name);
  private readonly sqs = new SQSClient({
    region: process.env.AWS_REGION,
  });

  constructor(private readonly dataSource: DataSource) {}

  async poll() {
    const res = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: process.env.GAME_RESULT_QUEUE_URL!,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 10,
      }),
    );

    if (!res.Messages) return;

    for (const msg of res.Messages) {
      try {
        const payload = JSON.parse(msg.Body!);
        await this.saveToDB(payload);

        await this.sqs.send(
          new DeleteMessageCommand({
            QueueUrl: process.env.GAME_RESULT_QUEUE_URL!,
            ReceiptHandle: msg.ReceiptHandle!,
          }),
        );
      } catch (e) {
        this.logger.error('❌ game-result consume failed', e);
      }
    }
  }

  private async saveToDB(payload: any) {
    const { gameId, roomId, results } = payload;

    const exists = await this.dataSource.query(
      `SELECT game_id FROM games WHERE game_id = ? LIMIT 1`,
      [gameId],
    );
    if (exists.length > 0) return;

    const filtered = results.filter(
      (r: any) => !r.googleSub.startsWith('BOT_'),
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO games (game_id, room_id, ended_at)
         VALUES (?, ?, ?)`,
        [gameId, roomId, new Date()],
      );

      for (const r of filtered) {
        await manager.query(
          `INSERT INTO game_results
           (game_id, google_sub, score, \`rank\`)
           VALUES (?, ?, ?, ?)`,
          [gameId, r.googleSub, r.score, r.rank],
        );
      }
    });

    this.logger.log(`✅ game-result saved: ${gameId}`);
  }
}
