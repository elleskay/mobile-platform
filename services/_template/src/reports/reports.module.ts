import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ClassifierModule } from "../classifier/classifier.module";
import { SearchModule } from "../search/search.module";

@Module({
  imports: [ClassifierModule, SearchModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
