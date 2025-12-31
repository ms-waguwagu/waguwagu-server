import { Injectable, Logger } from '@nestjs/common';
import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
} from '@aws-sdk/client-route-53';

@Injectable()
export class Route53Service {
  private readonly logger = new Logger(Route53Service.name);

  // Route53는 글로벌 서비스지만 SDK는 region이 필요함 (us-east-1 사용)
  private readonly client = new Route53Client({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  private readonly hostedZoneId = process.env.ROUTE53_HOSTED_ZONE_ID!;
  private readonly baseDomain = 'game.waguwagu.cloud';

  async upsertGameServerARecord(gameServerName: string, ip: string) {
    const fqdn = `${gameServerName}.${this.baseDomain}`;

    const cmd = new ChangeResourceRecordSetsCommand({
      HostedZoneId: this.hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT',
            ResourceRecordSet: {
              Name: fqdn,
              Type: 'A',
              TTL: 30,
              ResourceRecords: [{ Value: ip }],
            },
          },
        ],
      },
    });

    await this.client.send(cmd);
    this.logger.log(`[Route53] UPSERT A: ${fqdn} -> ${ip}`);
    return fqdn;
  }

  async deleteGameServerARecord(gameServerName: string, ip: string) {
    const fqdn = `${gameServerName}.${this.baseDomain}`;

    const cmd = new ChangeResourceRecordSetsCommand({
      HostedZoneId: this.hostedZoneId,
      ChangeBatch: {
        Changes: [
          {
            Action: 'DELETE',
            ResourceRecordSet: {
              Name: fqdn,
              Type: 'A',
              TTL: 30,
              ResourceRecords: [{ Value: ip }],
            },
          },
        ],
      },
    });

    await this.client.send(cmd);
    this.logger.log(`[Route53] DELETE A: ${fqdn}`);
  }
}
