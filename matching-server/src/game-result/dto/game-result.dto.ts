import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GameResultItemDto {
  @IsString()
  googleSub: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  score: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  rank: number;
}

export class GameResultDto {
  @IsString()
  gameId: string;

  @IsString()
  roomId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GameResultItemDto)
  results: GameResultItemDto[];
}
