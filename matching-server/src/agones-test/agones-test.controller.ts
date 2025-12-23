
import { Controller, Post } from "@nestjs/common";
import { AgonesTestService } from "./agones-test.service";

@Controller('agones')
export class AgonesTestController {
	constructor(private readonly agonesTestService: AgonesTestService) {}

@Post('/test/allocator')
async testAllocator() {
  const result = await this.agonesTestService.testAllocate();
  return {
    message: 'allocator 호출 성공',
    result,
  };
  }
}

