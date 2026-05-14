import type { Security } from "../domain/security";
import type { SecurityRepository } from "../repositories/security-repository";

export class SecurityMasterService {
  constructor(private readonly securities: SecurityRepository) {}

  async getSecurity(id: string): Promise<Security | null> {
    return this.securities.findById(id);
  }
}
