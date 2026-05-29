import { IsString, MinLength, MaxLength } from "class-validator";

// Validated by the global ValidationPipe (whitelist + forbidNonWhitelisted).
// Every controller boundary takes a DTO like this; never trust the raw body.
export class CheckMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;
}
