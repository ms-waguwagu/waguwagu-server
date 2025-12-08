import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class NicknameDto {
  @IsNotEmpty({ message: '닉네임은 필수 입력 값입니다.' })
  @IsString({ message: '닉네임은 문자열이어야 합니다.' })
  @MinLength(2, { message: '닉네임은 2자 이상이어야 합니다.' })
  @MaxLength(10, { message: '닉네임은 10자 이하이어야 합니다.' })
  nickname: string;
}
