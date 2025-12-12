/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class RankingService {
  private tableName = process.env.DYNAMO_TABLE_RANKING!;

  private client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    }),
  );

  // ⭐ 점수 저장
  async saveScore(playerId: string, nickname: string, score: number) {
    const timestamp = Date.now();

    const item = {
      playerId,
      playedAt: timestamp, // DynamoDB SortKey
      nickname,
      score,
      pk: 'RANK', // GSI 조회용
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );

    return true;
  }

  // ⭐ TOP10 조회 (GSI 사용)
  async getTop10() {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'ScoreIndex',
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': 'RANK',
        },
        ScanIndexForward: false, // 점수 DESC
      }),
    );

    if (!result.Items) return [];

    // ✅ 봇 제외 (nickname이 bot-* 인 경우)
    const humanOnly = result.Items.filter(
      (item) => !item.nickname?.startsWith('bot-'),
    );

    // ✅ TOP 10만 자르기
    return humanOnly.slice(0, 10).map((item, index) => ({
      rank: index + 1,
      playerId: item.playerId,
      nickname: item.nickname,
      score: item.score,
      playedAt: item.playedAt,
    }));
  }

  // ⭐ 특정 플레이어 최고 점수
  async getPlayerBestScore(playerId: string) {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'playerId = :pid',
        ExpressionAttributeValues: {
          ':pid': playerId,
        },
        ScanIndexForward: false, // playedAt 기준 내림차순
        Limit: 1,
      }),
    );

    return result.Items?.[0] || null;
  }
}
