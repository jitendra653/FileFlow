export interface SecurityTier {
  name: string;
  minScore: number;
  rateLimitMultiplier: number;
  description: string;
}

export const SECURITY_TIERS: SecurityTier[] = [
  {
    name: 'HIGH_RISK',
    minScore: 0,
    rateLimitMultiplier: 0.2, // 20% of base rate limit
    description: 'High risk users with very low security score'
  },
  {
    name: 'MEDIUM_RISK',
    minScore: 30,
    rateLimitMultiplier: 0.5, // 50% of base rate limit
    description: 'Medium risk users with concerning security patterns'
  },
  {
    name: 'STANDARD',
    minScore: 60,
    rateLimitMultiplier: 1.0, // Normal base rate limit
    description: 'Standard users with acceptable security practices'
  },
  {
    name: 'TRUSTED',
    minScore: 80,
    rateLimitMultiplier: 2.0, // Double the base rate limit
    description: 'Trusted users with good security practices'
  },
  {
    name: 'VIP',
    minScore: 95,
    rateLimitMultiplier: 5.0, // 5x the base rate limit
    description: 'VIP users with excellent security history'
  }
];

export const getSecurityTier = (securityScore: number): SecurityTier => {
  // Find the highest tier where the security score meets or exceeds the minimum score
  return SECURITY_TIERS.reduce((prev, current) => {
    return securityScore >= current.minScore ? current : prev;
  }, SECURITY_TIERS[0]);
};

export const calculateDynamicRateLimit = (baseLimit: number, securityScore: number): number => {
  const tier = getSecurityTier(securityScore);
  return Math.floor(baseLimit * tier.rateLimitMultiplier);
};