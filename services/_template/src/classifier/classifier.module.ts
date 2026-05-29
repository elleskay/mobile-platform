import { Module } from "@nestjs/common";
import { ClassifierService } from "./classifier.service";

@Module({
  providers: [ClassifierService],
  exports: [ClassifierService],
})
export class ClassifierModule {}
