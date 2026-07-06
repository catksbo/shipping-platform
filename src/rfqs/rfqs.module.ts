import { Module } from '@nestjs/common';
import { RfqsController } from './rfqs.controller';
import { RfqsService } from './rfqs.service';

@Module({
  controllers: [RfqsController],
  providers: [RfqsService],
})
export class RfqsModule {}
