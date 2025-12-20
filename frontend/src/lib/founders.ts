// Founder configuration with images
export interface FounderInfo {
  name: string;
  email: string;
  equityPercent: number;
  role: "FOUNDER";
  image: string;
}

export const FOUNDERS: FounderInfo[] = [
  {
    name: "Ramachandraa PS",
    email: "mail2ramachandraa@gmail.com",
    equityPercent: 34,
    role: "FOUNDER",
    image: "/images/founders/Ramachandraa.jpeg",
  },
  {
    name: "Rohith Babu ME",
    email: "rohithbabu031@gmail.com",
    equityPercent: 33,
    role: "FOUNDER",
    image: "/images/founders/RohithBabu.png",
  },
  {
    name: "Baranitharan S",
    email: "iambarani.45@gmail.com",
    equityPercent: 33,
    role: "FOUNDER",
    image: "/images/founders/Baranitharan.png",
  },
];

// Get founder by email
export function getFounderByEmail(email: string): FounderInfo | undefined {
  return FOUNDERS.find(f => f.email.toLowerCase() === email.toLowerCase());
}

// Get founder by name (partial match)
export function getFounderByName(name: string): FounderInfo | undefined {
  const normalizedName = name.toLowerCase();
  return FOUNDERS.find(f =>
    f.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(f.name.toLowerCase().split(" ")[0])
  );
}

// Get founder image by email or name
export function getFounderImage(emailOrName: string): string | undefined {
  const founder = getFounderByEmail(emailOrName) || getFounderByName(emailOrName);
  return founder?.image;
}

// Check if user is a founder
export function isFounder(email: string): boolean {
  return FOUNDERS.some(f => f.email.toLowerCase() === email.toLowerCase());
}
