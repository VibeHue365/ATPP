import { IsDateString, IsNotEmpty, Matches } from 'class-validator';

export class AssessSlotDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
    message: 'timeSlot must be in the format HH:mm-HH:mm (e.g. 14:00-16:00)',
  })
  timeSlot: string;
}
