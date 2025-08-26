import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskStatus } from './task-status.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { UsersRepository } from '../auth/users.repository';
import { Repository } from 'typeorm';
import { UserPayload } from '../auth/get-user.decorator';
import { User } from '../auth/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepository: Repository<Task>;
  let usersRepository: UsersRepository;

  const mockTasksRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTasksRepository,
        },
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    tasksRepository = module.get<Repository<Task>>(getRepositoryToken(Task));
    usersRepository = module.get<UsersRepository>(UsersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const createTaskDto: CreateTaskDto = {
        title: 'Test Task',
        description: 'Test Description',
        deletedAt: new Date(),
      };

      const userPayload: UserPayload = {
        sub: 'user-id-123',
        username: 'testuser',
      };

      const mockUser: User = {
        id: 'user-id-123',
        username: 'testuser',
        passwordHash: 'hashed-password',
        rtHash: null,
        tasks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
      };

      const mockTask: Task = {
        id: 'task-id-123',
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: TaskStatus.OPEN,
        user: mockUser,
        deletedAt: undefined,
      };

      mockUsersRepository.findById.mockResolvedValue(mockUser);
      mockTasksRepository.create.mockReturnValue(mockTask);
      mockTasksRepository.save.mockResolvedValue(mockTask);

      const result = await service.createTask(createTaskDto, userPayload);

      expect(mockUsersRepository.findById).toHaveBeenCalledWith(userPayload.sub);
      expect(mockTasksRepository.create).toHaveBeenCalledWith({
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: TaskStatus.OPEN,
        user: mockUser,
      });
      expect(mockTasksRepository.save).toHaveBeenCalledWith(mockTask);
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException when user not found', async () => {
      const createTaskDto: CreateTaskDto = {
        title: 'Test Task',
        description: 'Test Description',
        deletedAt: new Date(),
      };

      const userPayload: UserPayload = {
        sub: 'non-existent-user',
        username: 'testuser',
      };

      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.createTask(createTaskDto, userPayload))
        .rejects
        .toThrow(NotFoundException);

      expect(mockUsersRepository.findById).toHaveBeenCalledWith(userPayload.sub);
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks for a user', async () => {
      const userPayload: UserPayload = {
        sub: 'user-id-123',
        username: 'testuser',
      };

      const mockTasks: Task[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          status: TaskStatus.OPEN,
          user: {} as User,
          deletedAt: undefined,
        },
      ];

      mockTasksRepository.find.mockResolvedValue(mockTasks);

      const result = await service.getAllTasks(userPayload);

      expect(mockTasksRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userPayload.sub } },
      });
      expect(result).toEqual(mockTasks);
    });

    it('should return all tasks when no user context provided', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Description 1',
          status: TaskStatus.OPEN,
          user: {} as User,
          deletedAt: undefined,
        },
      ];

      mockTasksRepository.find.mockResolvedValue(mockTasks);

      const result = await service.getAllTasks();

      expect(mockTasksRepository.find).toHaveBeenCalledWith();
      expect(result).toEqual(mockTasks);
    });
  });
});
