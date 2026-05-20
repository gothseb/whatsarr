import { IsString, MinLength } from "class-validator";

export class PasswordDto {
  @IsString()
  @MinLength(12)
  password!: string;
}
