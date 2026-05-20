import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class ConnectWhatsAppDto {
  @IsOptional()
  @IsBoolean()
  replaceExistingSession?: boolean;
}

export class SelectServerGroupDto {
  @IsString()
  @MaxLength(200)
  groupId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsBoolean()
  confirmReplace?: boolean;
}
