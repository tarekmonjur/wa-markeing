import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanUsage } from './entities/plan-usage.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PlanUsageMiddleware } from './plan-usage.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([PlanUsage])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PlanUsageMiddleware).forRoutes('*');
  }
}
