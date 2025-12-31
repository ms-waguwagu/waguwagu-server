import { Controller, Post, UseGuards } from '@nestjs/common';
import { AgonesService } from './agones.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('')
export class AgonesController {
	constructor(private readonly agonesService: AgonesService) {}


}
