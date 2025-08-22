import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TaskStatus } from '../task-status.enum';
import { DeleteDateColumn } from 'typeorm';

export class GetTasksFilterDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @IsOptional()
  @IsString()
  dir?: 'ASC' | 'DESC' = 'DESC';
}
