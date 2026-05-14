import type { Security } from "../domain/security";

export interface SecurityRepository {
  findById(id: string): Promise<Security | null>;
}
