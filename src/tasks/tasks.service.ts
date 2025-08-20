import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Task, TaskStatus } from './task.module';
import { v4 as uuid } from 'uuid';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { ExternalExceptionFilter } from '@nestjs/core/exceptions/external-exception-filter';

@Injectable()
export class TasksService {
    private tasks: Task[] = [];

    getAllTasks(): Task[] {
        return this.tasks;
    }

    getTasksWithFilters(filterDto: GetTasksFilterDto): Task[] {
        const {status, search} = filterDto;

        let tasks = this.getAllTasks();

        if(status) {
            tasks = tasks.filter((task) => task.status === status);
        }

        if(search) {
            tasks = tasks.filter((task) => {
                if(task.title.includes(search) || task.description.includes(search)) {
                    return true;
                }
                return false;
            });
        }

        return tasks;
    }

    getTaskById(id: string): Task | null {
        const task = this.tasks.find(task => task.id === id);
        
        if(!task) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.NOT_FOUND,
                    error: `Not Found!`,
                    message: `Task With ID: ${id} NOT FOUND !`
                },
                HttpStatus.NOT_FOUND
            );
        } 
        
        return task;
    }

    createTask(createTaskDto: CreateTaskDto): Task {
        const { title, description } = createTaskDto;

        const task: Task = {
            id: uuid(),
            title: title,
            description: description,
            status: TaskStatus.OPEN
        }

        this.tasks.push(task);

        return task;
    }

    deleteTask(id: string): Task {
        const task = this.tasks.find(task => task.id === id);
        if(!task) {
            throw new NotFoundException(`Task With ID: ${id} NOT FOUND!`);
        }
        this.tasks = this.tasks.filter( task => task.id != id);
        return task;
    }

    updateTaskStatus(id:string, status: TaskStatus): Task {
        let task = this.getTaskById(id);
        if(!task) {
            throw new NotFoundException(`Task With ID: ${id} NOT FOUND!`);
        }
        task.status = status;
        return task;
    }
}
