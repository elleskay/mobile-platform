import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { ReportsModule } from "./reports/reports.module";
import { ClassifierModule } from "./classifier/classifier.module";
import { SearchModule } from "./search/search.module";

@Module({
  imports: [HealthModule, ReportsModule, ClassifierModule, SearchModule],
})
export class AppModule {}
