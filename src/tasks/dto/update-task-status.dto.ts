import { IsEnum } from "class-validator";
import { TaskStatus } from "../task.module";

export class UpdateTaskStatusDto {
    @IsEnum(TaskStatus)
    status: TaskStatus;
}