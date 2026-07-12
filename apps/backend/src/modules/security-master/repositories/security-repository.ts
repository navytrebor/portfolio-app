import type { Security } from "../domain/security";

export interface SecurityRepository {
  listAll(): Promise<Security[]>;
  findById(id: string): Promise<Security | null>;
}
