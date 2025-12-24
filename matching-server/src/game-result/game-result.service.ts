import { Injectable } from '@nestjs/common';

@Injectable()
export class GameResultService {
  async save(dto: any) {
    console.log('📦 GameResultService.save called', dto);
  }
}
