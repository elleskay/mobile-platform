import { IsString, IsOptional, IsIn, MinLength, MaxLength } from "class-validator";

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;

  @IsOptional()
  @IsIn(["sms", "call", "email", "message"])
  channel?: "sms" | "call" | "email" | "message";

  // Large attachments (screenshots, call audio) are uploaded to S3 via a
  // presigned URL and referenced here by key, never sent in this JSON body.
  // API Gateway caps the payload at 10 MB (CLAUDE.md gotcha #6).
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  attachmentKey?: string;
}
