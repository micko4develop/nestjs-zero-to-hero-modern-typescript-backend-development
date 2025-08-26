import { Module } from '@nestjs/common';
import { TasksModule } from './tasks/tasks.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // include .env global
    ConfigModule.forRoot({ 
      envFilePath: `.env.${process.env.APP_NAME}`, 
      validationSchema: configValidationSchema,
      isGlobal: true 
    }),

    TasksModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = process.env.APP_NAME === 'production';
        return {
          ssl: isProduction,
          extra: {
            ssl: isProduction ? { rejectUnauthorized: false } : null,
          },
          type: config.get<'postgres'>('DB_TYPE'),
          host: config.get<string>('DB_HOST'),
          port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
          autoLoadEntities: true,
          synchronize: (config.get<string>('DB_SYNC') ?? 'false') === 'true',
          logging: true,
        };
      },
    }),

    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}