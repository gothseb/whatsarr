import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class UpdateServiceSettingsDto {
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  password?: string;
}
