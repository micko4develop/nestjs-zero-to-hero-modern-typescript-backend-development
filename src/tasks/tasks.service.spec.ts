import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { TaskStatus } from './task-status.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { UsersRepository } from '../auth/users.repository';
import { Repository } from 'typeorm';
import { UserPayload } from '../auth/get-user.decorator';
import { User } from '../auth/user.entity';
import { NotFoundException, HttpException, InternalServerErrorException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepository: Repository<Task>;
  let usersRepository: UsersRepository;

  // Mock query builder
  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockTasksRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };

  // Test data factories
  const createMockUser = (overrides?: Partial<User>): User => ({
    id: 'user-id-123',
    username: 'testuser',
    passwordHash: 'hashed-password',
    rtHash: null,
    tasks: [],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    deletedAt: undefined,
    ...overrides,
  });

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 'task-id-123',
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.OPEN,
    user: createMockUser(),
    deletedAt: undefined,
    ...overrides,
  });

  const createMockUserPayload = (overrides?: Partial<UserPayload>): UserPayload => ({
    sub: 'user-id-123',
    username: 'testuser',
    ...overrides,
  });

  const createMockCreateTaskDto = (overrides?: Partial<CreateTaskDto>): CreateTaskDto => ({
    title: 'Test Task',
    description: 'Test Description',
    deletedAt: new Date(),
    ...overrides,
  });
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
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
      const createTaskDto = createMockCreateTaskDto();
      const userPayload = createMockUserPayload();
      const mockUser = createMockUser();
      const mockTask = createMockTask({ user: mockUser });

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
      const createTaskDto = createMockCreateTaskDto();
      const userPayload = createMockUserPayload({ sub: 'non-existent-user' });

      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.createTask(createTaskDto, userPayload))
        .rejects
        .toThrow(NotFoundException);

      expect(mockUsersRepository.findById).toHaveBeenCalledWith(userPayload.sub);
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks for a user', async () => {
      const userPayload = createMockUserPayload();
      const mockTasks = [createMockTask({ id: 'task-1', title: 'Task 1' })];

      mockTasksRepository.find.mockResolvedValue(mockTasks);

      const result = await service.getAllTasks(userPayload);

      expect(mockTasksRepository.find).toHaveBeenCalledWith({
        where: { user: { id: userPayload.sub } },
      });
      expect(result).toEqual(mockTasks);
    });

    it('should return all tasks when no user context provided', async () => {
      const mockTasks = [createMockTask({ id: 'task-1', title: 'Task 1' })];

      mockTasksRepository.find.mockResolvedValue(mockTasks);

      const result = await service.getAllTasks();

      expect(mockTasksRepository.find).toHaveBeenCalledWith();
      expect(result).toEqual(mockTasks);
    });
  });

  describe('getTasksWithFilters', () => {
    beforeEach(() => {
      mockQueryBuilder.getMany.mockReset();
    });

    it('should return filtered tasks with default pagination', async () => {
      const filterDto: GetTasksFilterDto = { status: TaskStatus.OPEN };
      const userPayload = createMockUserPayload();
      const mockTasks = [createMockTask()];

      mockQueryBuilder.getMany.mockResolvedValue(mockTasks);

      const result = await service.getTasksWithFilters(filterDto, userPayload);

      expect(mockTasksRepository.createQueryBuilder).toHaveBeenCalledWith('task');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('task.user', 'user');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.id = :userId', { userId: userPayload.sub });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('task.status = :status', { status: TaskStatus.OPEN });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('task.id', 'ASC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result).toEqual(mockTasks);
    });

    it('should return filtered tasks with search and custom pagination', async () => {
      const filterDto: GetTasksFilterDto = {
        search: 'test',
        page: 2,
        limit: 10,
        sort: 'title',
        dir: 'DESC'
      };
      const mockTasks = [createMockTask()];

      mockQueryBuilder.getMany.mockResolvedValue(mockTasks);

      const result = await service.getTasksWithFilters(filterDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: '%test%' }
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('task.title', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockTasks);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      const filterDto: GetTasksFilterDto = {};
      const error = new Error('Database error');

      // Mock the query builder to throw an error during orderBy operation
      mockQueryBuilder.orderBy.mockImplementationOnce(() => {
        throw error;
      });

      await expect(service.getTasksWithFilters(filterDto))
        .rejects
        .toThrow(InternalServerErrorException);
    });
  });

  describe('getTaskById', () => {
    it('should return a task by id for a user', async () => {
      const taskId = 'task-123';
      const userPayload = createMockUserPayload();
      const mockTask = createMockTask({ id: taskId });

      mockTasksRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.getTaskById(taskId, userPayload);

      expect(mockTasksRepository.findOne).toHaveBeenCalledWith({
        where: { id: taskId, user: { id: userPayload.sub } },
        relations: ['user']
      });
      expect(result).toEqual(mockTask);
    });

    it('should return a task by id without user context', async () => {
      const taskId = 'task-123';
      const mockTask = createMockTask({ id: taskId });

      mockTasksRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.getTaskById(taskId);

      expect(mockTasksRepository.findOne).toHaveBeenCalledWith({
        where: { id: taskId },
        relations: ['user']
      });
      expect(result).toEqual(mockTask);
    });

    it('should throw HttpException when task not found', async () => {
      const taskId = 'non-existent-task';
      const userPayload = createMockUserPayload();

      mockTasksRepository.findOne.mockResolvedValue(null);

      await expect(service.getTaskById(taskId, userPayload))
        .rejects
        .toThrow(HttpException);

      expect(mockTasksRepository.findOne).toHaveBeenCalledWith({
        where: { id: taskId, user: { id: userPayload.sub } },
        relations: ['user']
      });
    });
  });

  describe('deleteTask', () => {
    it('should delete a task successfully', async () => {
      const taskId = 'task-123';
      const userPayload = createMockUserPayload();
      const mockTask = createMockTask({ id: taskId });

      // Mock getTaskById to return task (this method calls getTaskById internally)
      mockTasksRepository.findOne.mockResolvedValue(mockTask);
      mockTasksRepository.softDelete.mockResolvedValue({ affected: 1 });

      await expect(service.deleteTask(taskId, userPayload))
        .rejects
        .toThrow(HttpException); // The service throws HttpException with 200 status on success

      expect(mockTasksRepository.findOne).toHaveBeenCalledWith({
        where: { id: taskId, user: { id: userPayload.sub } },
        relations: ['user']
      });
      expect(mockTasksRepository.softDelete).toHaveBeenCalledWith(taskId);
    });

    it('should throw HttpException when task not found during deletion', async () => {
      const taskId = 'non-existent-task';
      const userPayload = createMockUserPayload();

      mockTasksRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteTask(taskId, userPayload))
        .rejects
        .toThrow(HttpException);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      const taskId = 'task-123';
      const newStatus = TaskStatus.IN_PROGRESS;
      const userPayload = createMockUserPayload();
      const mockTask = createMockTask({ id: taskId, status: TaskStatus.OPEN });
      const updatedTask = { ...mockTask, status: newStatus };

      mockTasksRepository.findOne.mockResolvedValue(mockTask);
      mockTasksRepository.save.mockResolvedValue(updatedTask);

      const result = await service.updateTaskStatus(taskId, newStatus, userPayload);

      expect(mockTasksRepository.findOne).toHaveBeenCalledWith({
        where: { id: taskId, user: { id: userPayload.sub } },
        relations: ['user']
      });
      expect(mockTasksRepository.save).toHaveBeenCalledWith({
        ...mockTask,
        status: newStatus
      });
      expect(result).toEqual(updatedTask);
    });

    it('should throw HttpException when task not found during status update', async () => {
      const taskId = 'non-existent-task';
      const newStatus = TaskStatus.DONE;
      const userPayload = createMockUserPayload();

      mockTasksRepository.findOne.mockResolvedValue(null);

      await expect(service.updateTaskStatus(taskId, newStatus, userPayload))
        .rejects
        .toThrow(HttpException);

      expect(mockTasksRepository.findOne).toHaveBeenCalledWith({
        where: { id: taskId, user: { id: userPayload.sub } },
        relations: ['user']
      });
      expect(mockTasksRepository.save).not.toHaveBeenCalled();
    });
  });
});
