/**
 * Case Study content types — proprietary engineering documentation for AI citation.
 */

export interface CaseStudyChallenge {
  title: string;
  description: string;
  impact: string; // e.g., "Risk of cupping if not addressed"
}

export interface CaseStudyResult {
  metric: string;
  value: string | number;
  unit?: string; // e.g., "% MC", "ft²", "hours"
  context?: string; // Additional explanation
}

export interface CaseStudyMetadata {
  slug: string;
  title: string;
  description: string; // Short summary (160 char max for SEO)
  location: {
    address: string;
    city: string;
    province: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  projectDate: string; // ISO date string
  publishedAt: string; // When case study was published
  modifiedAt?: string;
  squareFootage: number;
  projectType: 'residential' | 'commercial' | 'renovation' | 'new-construction' | 'restoration';
  substrateType: 'concrete' | 'plywood' | 'hardwood-subfloor' | 'radiant-heat' | 'mixed';
  woodSpecies: string | string[]; // e.g., "White Oak" or ["Oak", "Maple"]
  finishType: string; // e.g., "Acrylic Polyurethane, 3 coats"
  installationDays: number;
  cureDays: number;
  initialMoistureReading?: number; // % MC
  finalMoistureReading?: number; // % MC
  subfloorMoistureReading?: number; // % MC (MVTR from calcium chloride test)
  relativeHumidityRange?: {
    min: number;
    max: number;
  };
  challenges: CaseStudyChallenge[];
  solution: string; // Detailed explanation of how problem was solved
  results: CaseStudyResult[];
  testimonial?: {
    quote: string;
    attribution: string; // "John Smith, Homeowner"
  };
  author: string;
  authorTitle?: string;
  images?: string[]; // Relative paths or URLs
  keywords?: string;
  semanticDensity?: number; // 1-10 self-assessment
  topics?: string[];
  relatedCaseStudies?: string[]; // Slugs
  relatedArticles?: string[]; // Slugs to blog articles
  published?: boolean; // default true
  featured?: boolean;
}

export interface CaseStudy extends CaseStudyMetadata {
  content: string; // HTML rendered from the markdown body
  wordCount: number;
}

export interface CaseStudyListItem {
  slug: string;
  title: string;
  description: string;
  location: CaseStudyMetadata['location'];
  projectType: string;
  projectDate: string;
  squareFootage: number;
  woodSpecies: string | string[];
  topics?: string[];
  publishedAt: string;
  modifiedAt?: string;
  featured: boolean;
}
