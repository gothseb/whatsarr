import { IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTemplateDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class PreviewTemplateDto {
  @IsString()
  body!: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, string>;
}
