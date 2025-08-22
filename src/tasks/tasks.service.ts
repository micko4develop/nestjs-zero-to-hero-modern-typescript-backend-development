import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from './task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { ExternalExceptionFilter } from '@nestjs/core/exceptions/external-exception-filter';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly tasksRepository: Repository<Task>,
    ) {}
    //private tasks: Task[] = [];

    async getAllTasks(): Promise<Task[]> {
        return this.tasksRepository.find();
    }

    async getTasksWithFilters(filterDto: GetTasksFilterDto): Promise<Task[]> {
        const { status, search } = filterDto;

        const page = filterDto['page'] ?? 1;
        const limit = filterDto['limit'] ?? 20;
        const sort = filterDto['sort'] ?? 'id';
        const dir = filterDto['dir'] ?? 'ASC';

        const qb = this.tasksRepository.createQueryBuilder('task');

        if (status) {
            qb.andWhere('task.status = :status', { status });
        }

        if (search) {
            qb.andWhere(
            '(task.title ILIKE :search OR task.description ILIKE :search)',
            { search: `%${search}%` },
            );
        }

        qb.orderBy(`task.${sort}`, dir as 'ASC' | 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        return qb.getMany();
    }

    async getTaskById(id: string): Promise<Task> {
        const found = await this.tasksRepository.findOne({ where: { id } });

        if(!found) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.NOT_FOUND,
                    error: `Not Found!`,
                    message: `Task With ID: ${id} NOT FOUND !`
                },
                HttpStatus.NOT_FOUND
            );
        }

        return found;
    }

    async createTask(createTask: CreateTaskDto): Promise<Task> {
        const { title, description } = createTask;
        const task = this.tasksRepository.create({
            title, 
            description,
            status: TaskStatus.OPEN
        });

        await this.tasksRepository.save(task);
        return task;
    }

    async deleteTask(id: string): Promise<void> {
        const res = await this.tasksRepository.delete(id);
        if (res.affected === 0) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.NOT_FOUND,
                    error: 'Not Found!',
                    message: `Task With ID: ${id} NOT FOUND!`,
                },
                HttpStatus.NOT_FOUND,
            );
        } else {
            throw new HttpException(
                {
                    statusCode: HttpStatus.OK,
                    success: 'Found!',
                    message: `Task With ID: ${id} DELETED!`,
                },
                HttpStatus.OK,
            );            
        }
    }

    async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
        const task = await this.tasksRepository.findOne({ where: { id } });

        if (!task) {
            throw new NotFoundException(`Task with ID ${id} Not Found!`);
        }

        task.status = status; 
        
        return await this.tasksRepository.save(task); 
    }
}
