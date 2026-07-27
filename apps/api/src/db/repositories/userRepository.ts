import type { User, UserId } from '@recoverai/shared';
import type { Queryable } from '../queryable';

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id as UserId,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateUserInput {
  /** Must equal the identity provider's user id (Supabase Auth once Part 3 wires it up). */
  id: UserId;
  email: string;
  fullName?: string | null;
}

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.db.query<UserRow>(
      `INSERT INTO users (id, email, full_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.id, input.email, input.fullName ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert into users returned no row');
    return toUser(row);
  }

  async findById(id: UserId): Promise<User | null> {
    const result = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  async updateProfile(id: UserId, patch: { fullName: string | null }): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      `UPDATE users SET full_name = $2 WHERE id = $1 RETURNING *`,
      [id, patch.fullName],
    );
    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  async delete(id: UserId): Promise<boolean> {
    const result = await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
