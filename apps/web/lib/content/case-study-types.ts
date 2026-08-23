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
  /**
   * Where the work was, at neighbourhood resolution and no finer.
   *
   * `address` and `coordinates` were removed on 2026-08-22 (F-176). The five
   * published case studies each named a private Toronto residence by street
   * address with latitude and longitude. There is no version of that which is
   * safe: if the project is real, a client's home address is published without
   * any evidence they agreed to it; if it is not, it is a fabricated record
   * carrying a real address. The type no longer has a place to put one.
   *
   * The neighbourhood was doing all of the local-search work regardless —
   * "Rosedale hardwood" is a query, "142 Scrivener Square hardwood" is not.
   */
  location: {
    neighbourhood: string;
    city: string;
    province: string;
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
  // semanticDensity removed — see lib/content/types.ts and F-163.
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
