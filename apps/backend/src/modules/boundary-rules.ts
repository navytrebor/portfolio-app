export type ModuleName =
  | "identity"
  | "portfolio"
  | "security-master"
  | "trade-registry"
  | "pricing-fx"
  | "valuation"
  | "performance";

export const moduleDependencyRules: Record<ModuleName, ModuleName[]> = {
  "identity": [],
  "portfolio": ["identity"],
  "security-master": [],
  "trade-registry": ["portfolio", "security-master"],
  "pricing-fx": ["security-master"],
  "valuation": ["portfolio", "trade-registry", "pricing-fx"],
  "performance": ["portfolio", "valuation"],
};

export function canDependOn(from: ModuleName, to: ModuleName): boolean {
  return moduleDependencyRules[from].includes(to);
}
