import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class MediaAvailabilityDto {
  @IsIn(["overseerr", "plex"])
  source!: "overseerr" | "plex";

  @IsIn(["movie", "season", "episode"])
  mediaType!: "movie" | "season" | "episode";

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  ratingKey?: string;

  @IsString()
  @IsOptional()
  tmdbId?: string;

  @IsInt()
  @IsOptional()
  seasonNumber?: number;

  @IsInt()
  @IsOptional()
  episodeNumber?: number;

  @IsString()
  @IsOptional()
  episodeTitle?: string;

  @IsString()
  @IsOptional()
  releaseDate?: string;

  @IsString()
  @IsOptional()
  posterUrl?: string;

  @IsString()
  @IsOptional()
  synopsis?: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requesterPlexUserIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  viewerPlexUserIds?: string[];
}

export class RecentWindowDto {
  @IsInt()
  @Min(1)
  @Max(60)
  months!: number;
}
