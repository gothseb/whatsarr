import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateUserContactMappingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  plexUserId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  whatsappId!: string;
}
