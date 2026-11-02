import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

/** UC-C10: photos the provider already uploaded in wizard step 1 (cover first). */
export class ProductDraftRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  imageUrls: string[];
}
