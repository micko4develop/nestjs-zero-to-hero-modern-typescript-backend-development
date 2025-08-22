import { IsString, Length, Matches, Max, MaxLength, MinLength } from "class-validator";

export class AuthCredentialsDto {
  @IsString()
  @MinLength(8, { message: 'Username must be at least 8 characters long!' })
  @MaxLength(20, { message: 'Username must be at most 20 characters long!' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long!' })
  @MaxLength(32, { message: 'Password must be at most 32 characters long!' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character!',
  })
  password: string;
}
