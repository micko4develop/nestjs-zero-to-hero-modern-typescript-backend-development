import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from './task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { ExternalExceptionFilter } from '@nestjs/core/exceptions/external-exception-filter';
import { InjectRepository } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Repository } from 'typeorm';
import { User } from 'src/auth/user.entity';
import { UsersRepository } from 'src/auth/users.repository';
import type { UserPayload } from 'src/auth/get-user.decorator';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private readonly tasksRepository: Repository<Task>,
        private readonly usersRepository: UsersRepository,
    ) {}
    //private tasks: Task[] = [];

    async getAllTasks(userPayload?: UserPayload): Promise<Task[]> {
        if (userPayload) {
            return this.tasksRepository.find({
                where: { user: { id: userPayload.sub } }
            });
        }
        return this.tasksRepository.find();
    }

    async getTasksWithFilters(filterDto: GetTasksFilterDto, userPayload?: UserPayload): Promise<Task[]> {
        const { status, search } = filterDto;

        const page = filterDto.page ?? 1;
        const limit = filterDto.limit ?? 20;
        const sort = filterDto.sort ?? 'id';
        const dir = filterDto.dir ?? 'ASC';

        const qb = this.tasksRepository.createQueryBuilder('task')
            .leftJoinAndSelect('task.user', 'user');
        
        // Filter by user if provided
        if (userPayload) {
            qb.andWhere('user.id = :userId', { userId: userPayload.sub });
        }

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

    async getTaskById(id: string, userPayload?: UserPayload): Promise<Task> {
        const whereCondition: any = { id };
        
        // If user context is provided, ensure task belongs to user
        if (userPayload) {
            whereCondition.user = { id: userPayload.sub };
        }
        
        const found = await this.tasksRepository.findOne({ 
            where: whereCondition,
            relations: ['user']
        });

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

    async createTask(createTask: CreateTaskDto, userPayload: UserPayload): Promise<Task> {
        const { title, description } = createTask;

        // Fetch the full user entity
        const user = await this.usersRepository.findById(userPayload.sub);
        if (!user) {
            throw new NotFoundException(`User with ID ${userPayload.sub} not found`);
        }

        const task = this.tasksRepository.create({
            title, 
            description,
            status: TaskStatus.OPEN,
            user
        });

        await this.tasksRepository.save(task);
        return task;
    }

    async deleteTask(id: string, userPayload?: UserPayload): Promise<void> {
        // First check if task exists and belongs to user (if user context provided)
        const task = await this.getTaskById(id, userPayload);
        
        const res = await this.tasksRepository.softDelete(id);
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

    async updateTaskStatus(id: string, status: TaskStatus, userPayload?: UserPayload): Promise<Task> {
        // Ensure task exists and belongs to user (if user context provided)
        const task = await this.getTaskById(id, userPayload);

        task.status = status; 
        
        return await this.tasksRepository.save(task); 
    }
}
