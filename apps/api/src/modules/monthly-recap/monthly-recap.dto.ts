import { IsArray, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class UpdateMonthlyRecapLibrariesDto {
  @IsArray()
  @IsString({ each: true })
  includedLibraryKeys!: string[];
}

export class RunMonthlyRecapDto {
  @IsString()
  @IsOptional()
  referenceDate?: string;
}

export class UpdateMonthlyRecapScheduleDto {
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;
}
