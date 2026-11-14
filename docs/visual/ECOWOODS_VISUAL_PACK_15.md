# Ecowoods Visual Pack 15

## Purpose
Fifteen new production illustrations to explain housing construction contexts, service geography, technical knowledge structure, and key article topics. All registered in the existing image manifest as kind: 'illustration' or 'diagram'. Never presented as photographs of real jobs.

## Base SHA
eab7fd9dd512253f07ad71b9408017d6cd0b209f

## The 15 Assets

| ID | Filename | Route | Section | Type | Dimensions | Alt | Caption |
|----|----------|-------|---------|------|------------|-----|---------|
| area-housing-prewar-heritage | area-housing-prewar-heritage.webp | /service-areas/[city] | Housing stock | illustration | 1600x900 | A heritage home's original hardwood floor shown above an older timber subfloor and floor joists. | Older homes can conceal several generations of flooring and subfloor construction. Identifying the existing assembly comes before choosing a new installation method. |
| area-housing-postwar-suburban | area-housing-postwar-suburban.webp | /service-areas/[city] | Housing stock | illustration | 1600x900 | A suburban home's hardwood flooring assembly above a plywood subfloor and timber joists. | Subfloor condition and structural support influence preparation, fastening and the installation method selected for an existing house. |
| area-housing-condo-concrete-slab | area-housing-condo-concrete-slab.webp | /service-areas/[city] | Housing stock | illustration | 1600x900 | Engineered hardwood flooring and its installation layers above a condominium concrete slab. | A condominium's concrete slab changes the flooring specification. The selected installation assembly must account for the actual substrate and applicable building requirements. |
| area-housing-radiant-newbuild | area-housing-radiant-newbuild.webp | /service-areas/[city] | Housing stock | illustration | 1600x900 | Engineered hardwood above a radiant-heated floor assembly in a modern home. | Radiant heating introduces thermal cycling. The flooring product and installation method must be selected for the actual heated assembly. |
| service-areas-gta-corridors-map | service-areas-gta-corridors-map.webp | /service-areas | After intro | diagram | 1600x900 | Schematic map of Ecowoods' published service regions and geographical corridors. | An overview of Ecowoods' published service regions, organised using its existing corridor and area listings. Consult the individual area pages for local service information. |
| technical-library-corpus-map | technical-library-corpus-map.webp | /technical-library | Intro | diagram | 1600x900 | Map of the Ecowoods technical library connecting its papers, guides, articles, standards and flooring references. | The technical library connects material science, installation methods, published standards and practical flooring decisions. |
| technical-pillar-moisture-management | technical-pillar-moisture-management.webp | /technical-library | Moisture pillar | illustration | 1600x900 | Hardwood moisture assessment connecting subfloor readings, material readings and room conditions. | Successful installation begins with an assessment of the existing substrate, the flooring material and the conditions in which the floor will perform. |
| technical-pillar-wood-science | technical-pillar-wood-science.webp | /technical-library | Wood Science pillar | illustration | 1600x900 | Hardwood samples illustrating differences in species grain, colour, pore structure and appearance. | Hardwood species differ in appearance and material characteristics, which influence selection, finishing and the suitability of a product for a particular project. |
| technical-pillar-installation-finishing | technical-pillar-installation-finishing.webp | /technical-library | Installation pillar | illustration | 1600x900 | Hardwood flooring installation and finishing stages from substrate preparation to the finished surface. | The visible floor is the final result of several connected operations: substrate preparation, correct installation, surface preparation and finish application. |
| article-subfloor-moisture-testing | article-subfloor-moisture-testing.webp | /blog & /blog/subfloor-moisture-testing-protocol | Card + detail | illustration | 1600x900 | Subfloor and hardwood moisture assessment before a new flooring installation. | Moisture assessment combines the substrate, flooring material and site conditions. The results should be documented before the installation method is finalised. |
| article-hepa-dust-extraction | article-hepa-dust-extraction.webp | /blog & /blog/dust-free-sanding-hepa-extraction-explained | Card + detail | illustration | 1600x900 | Floor-sanding machine connected to a sealed dust extraction and filtration system. | Effective dust management is a system involving collection at the tool, appropriate extraction, filtration and containment of the work area. |
| article-hardwood-species-comparison | article-hardwood-species-comparison.webp | /blog & /blog/species-comparison-matrix-toronto-renovations | Card + detail | illustration | 1600x900 | Comparative hardwood sample boards showing the different grain and appearance of flooring species. | Comparing species visually helps establish the appearance of a floor before considering hardness, cost, finish compatibility and installation requirements. |
| article-water-vs-oil-finish | article-water-vs-oil-finish.webp | /blog & /blog/water-based-vs-oil-based-polyurethane-chemistry | Card + detail | illustration | 1600x900 | Matched hardwood samples illustrating the appearance differences between water-based and oil-based finishes. | Finish chemistry affects the final appearance and characteristics of a hardwood surface. The appropriate choice depends on the product, requirements and desired result. |
| article-wood-acclimation-timeline | article-wood-acclimation-timeline.webp | /blog & /blog/wood-acclimation-timeline-toronto-gta | Card + detail | illustration | 1600x900 | Hardwood flooring acclimation process showing site assessment, material measurement and installation preparation. | Acclimation should be understood as an assessment of material and site conditions, rather than an arbitrary number of days. |
| article-white-oak-vs-red-oak | article-white-oak-vs-red-oak.webp | /blog & /blog/white-oak-vs-red-oak-tannin-behavior | Card + detail | illustration | 1600x900 | White oak and red oak samples compared by grain, colour and wood structure. | White oak and red oak have distinct material characteristics. Understanding those differences helps inform species selection and finishing decisions. |

## Visual Register
Warm cream (#faf6ef), deep walnut (#3d2b1f), copper (#c87e4f), muted sage (#42704f). Mix of detailed architectural/material illustrations and flat systems diagrams. No text baked into images.

## Integration
- Service area city pages select one of the four housing illustrations based on the published housingNote content.
- Service areas index shows the schematic corridor map.
- Technical library shows corpus map and pillar-specific illustrations.
- Blog cards and article detail pages use the matching article illustrations.
- Frontmatter image fields updated for OG metadata.
- All registered in apps/web/lib/images.ts and static imports regenerated.

## Verification
node scripts/gen-illustration-imports.mjs
node scripts/verify-images.mjs
pnpm verify
pnpm build
