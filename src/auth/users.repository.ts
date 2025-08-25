import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { User } from './user.entity';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import * as bcrypt from 'bcrypt';

export type SortDir = 'ASC' | 'DESC';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findById(id: string) {
    return this.repo.findOne({ 
      where: { id },
      relations: [] // Explicitly exclude relations to prevent circular references
    });
  }

  async findByUsername(username: string) {
    return this.repo.findOne({ 
      where: { username },
      relations: [] // Explicitly exclude relations to prevent circular references
    });
  }

  async existsByUsername(username: string) {
    return this.repo.exist({ where: { username } });
  }

  async createAndSave(data: Partial<User>) {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async createUser(username: string, plainPassword: string) {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(plainPassword, salt);
    const user = this.repo.create({ username, passwordHash });
    return this.repo.save(user);
  }

  async setRefreshToken(userId: string, refreshToken: string | null) {
    const rtHash = refreshToken ? await bcrypt.hash(refreshToken, 12) : null;
    await this.repo.update({ id: userId }, { rtHash });
  }

  async compareRefreshToken(user: User, incomingRt: string): Promise<boolean> {
    if (!user.rtHash) return false;
    return bcrypt.compare(incomingRt, user.rtHash);
  }

  async updatePartial(id: string, data: Partial<User>) {
    const res = await this.repo.update({ id }, data);
    if (!res.affected) throw new NotFoundException(`User ${id} not found`);
    return this.findById(id);
  }

  async softDeleteById(id: string) {
    const res = await this.repo.softDelete({ id });
    if (!res.affected) throw new NotFoundException(`User ${id} not found`);
  }

  async restoreById(id: string) {
    const res = await this.repo.restore({ id });
    if (!res.affected) throw new NotFoundException(`User ${id} not found`);
    return this.findById(id);
  }

  /*async findOnlyDeleted() {
    return this.repo.find({
      withDeleted: true,
      where: { deletedAt: Not(IsNull()) },
    });
  }*/

  async paginate({
    page = 1,
    limit = 20,
    sort = 'createdAt',
    dir = 'DESC' as SortDir,
    search,
  }: {
    page?: number;
    limit?: number;
    sort?: string;
    dir?: SortDir;
    search?: string;
  }) {
    const qb = this.repo.createQueryBuilder('user');

    if (search) {
      qb.andWhere('(user.username ILIKE :s OR user.email ILIKE :s)', {
        s: `%${search}%`,
      });
    }

    const sortCol = sort.includes('.') ? sort : `user.${sort}`;

    const [data, total] = await qb
      .orderBy(sortCol, dir)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
  
}
