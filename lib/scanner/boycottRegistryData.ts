/**
 * Authoritative Brand -> Parent Company Registry & Normalization Rules
 *
 * HOW TO ADD FUTURE BRAND -> PARENT ROWS:
 * 1. Add `[brandName, parentOwnerRawText]` to `RAW_BRAND_PARENT_ROWS` below (or insert directly into `company_relationships`).
 * 2. Run `node scripts/seed-boycott-registry.js` to idempotently upsert into Supabase `company_relationships`.
 * 3. Every subsidiary or brand under a targeted parent in `campaign_targets` automatically inherits the parent's
 *    boycott status via `BoycottScreeningService.screenBrand` parent-first ownership chain resolution.
 * 4. Rows marked "Unverified" or "Multiple brands; unverified" are stored with `relationship_type = 'unverified'`
 *    and NEVER trigger an automatic boycott flag.
 */

export interface CanonicalCampaignTarget {
  companyName: string;
  aliases: string[];
  targetType: 'parent' | 'direct';
  reason: string;
  sourceUrl: string;
}

export interface ParsedBrandRelationship {
  brandName: string;
  normalizedBrand: string;
  parentCompany: string;
  normalizedParent: string;
  rawParentText: string;
  relationshipType: 'parent' | 'subsidiary' | 'joint_venture' | 'licensed' | 'unverified';
  notes: string | null;
  sourceUrl: string;
}

/**
 * Strips diacritics (e.g. Mondelēz -> Mondelez, Nestlé -> Nestle, Côte d’Or -> Cote d'Or),
 * normalizes quotes/apostrophes, and collapses punctuation into clean tokens.
 */
export function normalizeEntityKey(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘`´']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips legal corporate suffixes (The, Company, Group, S.A., PLC, Incorporated, Inc., etc.)
 * so "The Coca-Cola Company" and "Coca-Cola" or "Nestlé S.A." and "Nestle" share a base token when needed.
 */
export function normalizeBaseCorporateKey(input: string): string {
  const key = normalizeEntityKey(input);
  if (!key) return '';
  return key
    .replace(/^the\s+/, '')
    .replace(
      /\b(company|group|international|incorporated|inc|corp|corporation|plc|sa|s a|ltd|limited|holdings|holding|enterprises|brands|foods|beverages|petcare|petfoods|a d)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical parent legal names map.
 * Ensures that variations in the raw parent column (e.g. "Mars", "Mars, Incorporated", "Mars (Wrigley)",
 * "Nestlé", "Nestlé S.A.", "Mondelēz", "Mondelēz International", "Coca-Cola", "The Coca-Cola Company")
 * resolve to the exact canonical parent string used in `campaign_targets`.
 */
export const CANONICAL_PARENT_MAP: Record<string, string> = {
  // Nestlé S.A.
  [normalizeEntityKey('Nestlé')]: 'Nestlé S.A.',
  [normalizeEntityKey('Nestle')]: 'Nestlé S.A.',
  [normalizeEntityKey('Nestlé S.A.')]: 'Nestlé S.A.',
  [normalizeEntityKey('Nestle S.A.')]: 'Nestlé S.A.',
  [normalizeEntityKey('Nestlé Health Science')]: 'Nestlé S.A.',

  // PepsiCo
  [normalizeEntityKey('PepsiCo')]: 'PepsiCo',
  [normalizeEntityKey('PepsiCo, Inc.')]: 'PepsiCo',
  [normalizeEntityKey('Pepsi')]: 'PepsiCo',

  // The Coca-Cola Company
  [normalizeEntityKey('The Coca-Cola Company')]: 'The Coca-Cola Company',
  [normalizeEntityKey('Coca-Cola')]: 'The Coca-Cola Company',
  [normalizeEntityKey('Coca Cola')]: 'The Coca-Cola Company',
  [normalizeEntityKey('The Coca-Cola HBC Group')]: 'The Coca-Cola HBC Group',
  [normalizeEntityKey('Coca-Cola Europacific Partners')]: 'Coca-Cola Europacific Partners',
  [normalizeEntityKey('Aujan Coca-Cola Beverages Company')]: 'Aujan Coca-Cola Beverages Company',

  // Mars, Incorporated
  [normalizeEntityKey('Mars')]: 'Mars, Incorporated',
  [normalizeEntityKey('Mars, Incorporated')]: 'Mars, Incorporated',
  [normalizeEntityKey('Mars Inc.')]: 'Mars, Incorporated',
  [normalizeEntityKey('Mars (Wrigley)')]: 'Mars (Wrigley)',
  [normalizeEntityKey('Mars (Kellanova)')]: 'Mars (Kellanova)',
  [normalizeEntityKey('Mars (Champion Petfoods)')]: 'Mars (Champion Petfoods)',

  // Mondelēz International
  [normalizeEntityKey('Mondelēz International')]: 'Mondelēz International',
  [normalizeEntityKey('Mondelez International')]: 'Mondelēz International',
  [normalizeEntityKey('Mondelēz')]: 'Mondelēz International',
  [normalizeEntityKey('Mondelez')]: 'Mondelēz International',

  // Unilever PLC & The Magnum Ice Cream Company
  [normalizeEntityKey('Unilever')]: 'Unilever PLC',
  [normalizeEntityKey('Unilever PLC')]: 'Unilever PLC',
  [normalizeEntityKey('Hindustan Unilever')]: 'Hindustan Unilever',
  [normalizeEntityKey('The Magnum Ice Cream Company')]: 'The Magnum Ice Cream Company',
  [normalizeEntityKey('Magnum Ice Cream Company')]: 'The Magnum Ice Cream Company',

  // Danone S.A.
  [normalizeEntityKey('Danone')]: 'Danone S.A.',
  [normalizeEntityKey('Danone S.A.')]: 'Danone S.A.',
  [normalizeEntityKey('Al Safi Danone')]: 'Al Safi Danone',

  // Ferrero Group
  [normalizeEntityKey('Ferrero Group')]: 'Ferrero Group',
  [normalizeEntityKey('Ferrero')]: 'Ferrero Group',

  // The Hershey Company
  [normalizeEntityKey('The Hershey Company')]: 'The Hershey Company',
  [normalizeEntityKey('Hershey')]: 'The Hershey Company',
  [normalizeEntityKey("Hershey's")]: 'The Hershey Company',

  // Kraft Heinz
  [normalizeEntityKey('Kraft Heinz')]: 'Kraft Heinz',
  [normalizeEntityKey('The Kraft Heinz Company')]: 'Kraft Heinz',

  // Procter & Gamble
  [normalizeEntityKey('Procter & Gamble')]: 'Procter & Gamble',
  [normalizeEntityKey('P&G')]: 'Procter & Gamble',

  // JAB Holding Company
  [normalizeEntityKey('JAB Holding Company')]: 'JAB Holding Company',
  [normalizeEntityKey('JAB Holding')]: 'JAB Holding Company',

  // Keurig Dr Pepper
  [normalizeEntityKey('Keurig Dr Pepper')]: 'Keurig Dr Pepper',

  // General Mills
  [normalizeEntityKey('General Mills')]: 'General Mills',

  // The Wonderful Company
  [normalizeEntityKey('The Wonderful Company')]: 'The Wonderful Company',

  // Strauss Group
  [normalizeEntityKey('Strauss Group')]: 'Strauss Group',

  // Bright Food Group
  [normalizeEntityKey('Bright Food Group')]: 'Bright Food Group',

  // Heineken
  [normalizeEntityKey('Heineken')]: 'Heineken',
  [normalizeEntityKey('Heineken Beverages')]: 'Heineken',

  // Carlsberg Group
  [normalizeEntityKey('Carlsberg Group')]: 'Carlsberg Group',

  // AB InBev
  [normalizeEntityKey('AB InBev')]: 'AB InBev',

  // Barilla Group
  [normalizeEntityKey('Barilla Group')]: 'Barilla Group',

  // The Arnott's Group / KKR
  [normalizeEntityKey("The Arnott's Group / KKR")]: "The Arnott's Group / KKR",
  [normalizeEntityKey("Arnott's Group")]: "The Arnott's Group / KKR",

  // Affinity Petcare
  [normalizeEntityKey('Affinity Petcare')]: 'Affinity Petcare (Agrolimen Group)',
  [normalizeEntityKey('Affinity Petcare (Agrolimen Group)')]: 'Affinity Petcare (Agrolimen Group)',

  // Lidl / Schwarz Group
  [normalizeEntityKey('Lidl / Schwarz Group')]: 'Lidl / Schwarz Group',

  // L'Oréal
  [normalizeEntityKey("L'Oréal")]: "L'Oréal"
};

/**
 * Intermediate Subsidiary -> Ultimate Parent links.
 * Enables multi-hop ownership chain resolution (e.g. Friskies -> Nestlé Purina -> Nestlé S.A.).
 */
export const INTERMEDIATE_PARENT_LINKS: Array<{
  subsidiary: string;
  parentCompany: string;
  relationshipType: 'subsidiary' | 'joint_venture' | 'parent';
  notes?: string;
}> = [
  { subsidiary: 'Nestlé Purina', parentCompany: 'Nestlé S.A.', relationshipType: 'subsidiary', notes: 'Petcare division of Nestlé S.A.' },
  { subsidiary: 'Cereal Partners Worldwide', parentCompany: 'Nestlé S.A.', relationshipType: 'joint_venture', notes: 'Nestlé and General Mills joint venture' },
  { subsidiary: 'Froneri', parentCompany: 'Nestlé S.A.', relationshipType: 'joint_venture', notes: 'Nestlé and PAI Partners ice-cream joint venture' },
  { subsidiary: 'Froneri International', parentCompany: 'Nestlé S.A.', relationshipType: 'joint_venture', notes: 'Nestlé and PAI Partners ice-cream joint venture' },
  { subsidiary: 'Mars (Wrigley)', parentCompany: 'Mars, Incorporated', relationshipType: 'subsidiary', notes: 'Wrigley confectionery division of Mars, Incorporated' },
  { subsidiary: 'Wrigley', parentCompany: 'Mars, Incorporated', relationshipType: 'subsidiary', notes: 'Wrigley division of Mars, Incorporated' },
  { subsidiary: 'Mars (Kellanova)', parentCompany: 'Mars, Incorporated', relationshipType: 'subsidiary', notes: 'Kellanova acquired by Mars, Incorporated' },
  { subsidiary: 'Kellanova', parentCompany: 'Mars, Incorporated', relationshipType: 'subsidiary', notes: 'Kellanova division under Mars, Incorporated' },
  { subsidiary: 'Mars (Champion Petfoods)', parentCompany: 'Mars, Incorporated', relationshipType: 'subsidiary', notes: 'Champion Petfoods subsidiary of Mars, Incorporated' },
  { subsidiary: 'Champion Petfoods', parentCompany: 'Mars, Incorporated', relationshipType: 'subsidiary', notes: 'Subsidiary of Mars, Incorporated' },
  { subsidiary: 'The Coca-Cola HBC Group', parentCompany: 'The Coca-Cola Company', relationshipType: 'subsidiary', notes: 'Anchor bottler of The Coca-Cola Company' },
  { subsidiary: 'Bambi a.d. / The Coca-Cola HBC Group', parentCompany: 'The Coca-Cola Company', relationshipType: 'subsidiary', notes: 'Owned by Coca-Cola HBC' },
  { subsidiary: 'Coca-Cola Europacific Partners', parentCompany: 'The Coca-Cola Company', relationshipType: 'subsidiary', notes: 'Major bottling partner of The Coca-Cola Company' },
  { subsidiary: 'Aujan Coca-Cola Beverages Company', parentCompany: 'The Coca-Cola Company', relationshipType: 'joint_venture', notes: 'Coca-Cola Middle East beverage partnership' },
  { subsidiary: 'PepsiCo (Pioneer Foods)', parentCompany: 'PepsiCo', relationshipType: 'subsidiary', notes: 'Pioneer Foods is a wholly owned subsidiary of PepsiCo' },
  { subsidiary: 'Pioneer Foods / PepsiCo', parentCompany: 'PepsiCo', relationshipType: 'subsidiary', notes: 'Pioneer Foods is a wholly owned subsidiary of PepsiCo' },
  { subsidiary: 'PepsiCo / Pioneer Foods', parentCompany: 'PepsiCo', relationshipType: 'subsidiary', notes: 'Pioneer Foods is a wholly owned subsidiary of PepsiCo' },
  { subsidiary: 'Pioneer Foods', parentCompany: 'PepsiCo', relationshipType: 'subsidiary', notes: 'Wholly owned subsidiary of PepsiCo' },
  { subsidiary: 'Pepsi Lipton partnership', parentCompany: 'PepsiCo', relationshipType: 'joint_venture', notes: 'PepsiCo and Lipton ready-to-drink joint venture' },
  { subsidiary: 'Ferrero Group (Wells Enterprises)', parentCompany: 'Ferrero Group', relationshipType: 'subsidiary', notes: 'Wells Enterprises acquired by Ferrero Group' },
  { subsidiary: 'Wells Enterprises / Ferrero Group', parentCompany: 'Ferrero Group', relationshipType: 'subsidiary', notes: 'Wells Enterprises acquired by Ferrero Group' },
  { subsidiary: 'Wells Enterprises', parentCompany: 'Ferrero Group', relationshipType: 'subsidiary', notes: 'Subsidiary of Ferrero Group' },
  { subsidiary: "Ferrero Group / Fox's Burton's Companies", parentCompany: 'Ferrero Group', relationshipType: 'subsidiary', notes: "Fox's Burton's Companies is a Ferrero-affiliated group" },
  { subsidiary: 'Ferrero / WK Kellogg', parentCompany: 'Ferrero Group', relationshipType: 'subsidiary', notes: 'North American cereal operations under Ferrero / WK Kellogg' },
  { subsidiary: 'Hindustan Unilever', parentCompany: 'Unilever PLC', relationshipType: 'subsidiary', notes: 'Indian subsidiary of Unilever PLC' },
  { subsidiary: 'The Magnum Ice Cream Company', parentCompany: 'Unilever PLC', relationshipType: 'subsidiary', notes: 'Unilever ice-cream business unit / spin-off' },
  { subsidiary: 'Al Safi Danone', parentCompany: 'Danone S.A.', relationshipType: 'joint_venture', notes: 'Danone joint venture' },
  { subsidiary: 'Panera Brands / JAB Holding', parentCompany: 'JAB Holding Company', relationshipType: 'subsidiary', notes: 'Owned by JAB Holding Company' },
  { subsidiary: 'Panera Brands / Einstein Bros Bagels', parentCompany: 'JAB Holding Company', relationshipType: 'subsidiary', notes: 'Owned by JAB Holding Company' },
  { subsidiary: 'Espresso House Group / JAB Holding', parentCompany: 'JAB Holding Company', relationshipType: 'subsidiary', notes: 'Owned by JAB Holding Company' },
  { subsidiary: "JDE Peet's", parentCompany: 'JAB Holding Company', relationshipType: 'subsidiary', notes: 'Majority-owned by JAB Holding Company' },
  { subsidiary: 'Wonderful Citrus / The Wonderful Company', parentCompany: 'The Wonderful Company', relationshipType: 'subsidiary', notes: 'Division of The Wonderful Company' }
];

/**
 * Active Campaign Parent Targets seeded into `campaign_targets`.
 * Parent legal names match the canonical parent strings resolved from `company_relationships`.
 */
export const CANONICAL_CAMPAIGN_TARGETS: CanonicalCampaignTarget[] = [
  {
    companyName: 'Nestlé S.A.',
    aliases: ['Nestlé', 'Nestle', 'Nestlé Purina', 'Nestle Purina', 'Cereal Partners Worldwide', 'Froneri', 'Froneri International'],
    targetType: 'parent',
    reason: 'Owns Osem (major Israeli food manufacturer) and maintains extensive commercial operations in Israel.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'PepsiCo',
    aliases: ['PepsiCo, Inc.', 'Pepsi', 'Frito-Lay', 'Pioneer Foods', 'PepsiCo (Pioneer Foods)', 'Pepsi Lipton partnership'],
    targetType: 'parent',
    reason: 'Acquired SodaStream for $3.2B and holds a 50% stake in Sabra alongside the Strauss Group.',
    sourceUrl: 'https://bdsmovement.net/get-involved/what-to-boycott'
  },
  {
    companyName: 'The Coca-Cola Company',
    aliases: ['Coca-Cola', 'Coca Cola', 'The Coca-Cola HBC Group', 'Coca-Cola Europacific Partners', 'Aujan Coca-Cola Beverages Company'],
    targetType: 'parent',
    reason: 'Central Bottling Company (Coca-Cola Israel) operates distribution and manufacturing facilities in the Atarot settlement industrial zone.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Mars, Incorporated',
    aliases: ['Mars', 'Mars Inc.', 'Mars (Wrigley)', 'Wrigley', 'Mars (Kellanova)', 'Kellanova', 'Mars (Champion Petfoods)', 'Champion Petfoods'],
    targetType: 'parent',
    reason: 'Committed multi-million-dollar venture capital investments in Israeli foodtech partnerships via Jerusalem Venture Partners (JVP).',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Mondelēz International',
    aliases: ['Mondelēz', 'Mondelez', 'Mondelez International'],
    targetType: 'parent',
    reason: 'Invested in Israeli startup foodtech incubators (The Kitchen Hub with Strauss Group) and corporate venture partnerships.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Unilever PLC',
    aliases: ['Unilever', 'Hindustan Unilever'],
    targetType: 'parent',
    reason: 'Maintains commercial supply chains, factory operations, and local subsidiary investments in the region.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'The Magnum Ice Cream Company',
    aliases: ['Magnum Ice Cream Company', 'Wall’s', 'Algida'],
    targetType: 'parent',
    reason: 'Unilever ice-cream division / parent entity associated with contested licensing restructuring.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Danone S.A.',
    aliases: ['Danone', 'Al Safi Danone'],
    targetType: 'parent',
    reason: 'Holds a ~20% equity stake in the Strauss Group (Strauss Dairies) and leads investment rounds in Israeli foodtech.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Ferrero Group',
    aliases: ['Ferrero', 'Ferrero International S.A.', 'Wells Enterprises', 'Ferrero Group (Wells Enterprises)', "Fox's Burton's Companies", 'Ferrero / WK Kellogg'],
    targetType: 'parent',
    reason: 'Flagged under consumer corporate responsibility campaigns for global supply chain and market operations.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'The Hershey Company',
    aliases: ['Hershey', "Hershey's"],
    targetType: 'parent',
    reason: 'Flagged under consumer corporate accountability and ethical sourcing watchlists.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Kraft Heinz',
    aliases: ['The Kraft Heinz Company', 'Kraft', 'Heinz'],
    targetType: 'parent',
    reason: 'Documented corporate partnerships and commercial distribution ties under active boycott review.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Procter & Gamble',
    aliases: ['P&G'],
    targetType: 'parent',
    reason: 'Operates a major R&D center in Tel Aviv investing annually in local technology partnerships.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Strauss Group',
    aliases: ['Strauss', 'Elite'],
    targetType: 'parent',
    reason: 'Major Israeli food and beverage manufacturer with documented support for military units.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Bright Food Group',
    aliases: ['Tnuva', 'Bright Dairy & Food Co'],
    targetType: 'parent',
    reason: 'Majority owner of Tnuva, the largest food and dairy cooperative operating in Israeli settlements.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'The Wonderful Company',
    aliases: ['Wonderful Citrus', 'Wonderful Pistachios', 'Fiji Water'],
    targetType: 'parent',
    reason: 'Documented philanthropic and foundation funding supporting advocacy and infrastructure programs in Israel.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: "L'Oréal",
    aliases: ['Loreal', 'Elvive'],
    targetType: 'parent',
    reason: 'Long-standing manufacturing and R&D operations in Israel.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Starbucks',
    aliases: ['Starbucks Corporation'],
    targetType: 'parent',
    reason: 'Targeted by consumer solidarity boycotts over union litigation.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'SodaStream',
    aliases: [],
    targetType: 'direct',
    reason: 'Official BDS campaign target; wholly owned subsidiary of PepsiCo.',
    sourceUrl: 'https://bdsmovement.net/get-involved/what-to-boycott'
  },
  {
    companyName: 'Sabra',
    aliases: ['Sabra Dipping Company'],
    targetType: 'direct',
    reason: 'Official BDS campaign target; formerly a joint venture between PepsiCo and the Strauss Group.',
    sourceUrl: 'https://bdsmovement.net/get-involved/what-to-boycott'
  },
  {
    companyName: 'Osem',
    aliases: ['Osem Investments'],
    targetType: 'direct',
    reason: 'Israeli food manufacturer wholly owned by Nestlé S.A.',
    sourceUrl: 'https://bdsmovement.net'
  },
  {
    companyName: 'Ahava',
    aliases: ['Ahava Dead Sea Laboratories'],
    targetType: 'direct',
    reason: 'Official BDS campaign target operating in the Dead Sea region.',
    sourceUrl: 'https://bdsmovement.net/get-involved/what-to-boycott'
  },
  {
    companyName: 'Teva Pharmaceuticals',
    aliases: ['Teva'],
    targetType: 'parent',
    reason: 'Major Israeli pharmaceutical company targeted by consumer boycott campaigns.',
    sourceUrl: 'https://bdsmovement.net'
  }
];

/**
 * Complete A–Z + Additional Brands Registry from the specification.
 * Format: [brandName, rawParentCompanyOrOwner]
 */
export const RAW_BRAND_PARENT_ROWS: Array<[string, string]> = [
  // ─── A ───
  ['100 Grand', 'Ferrero Group'],
  ['18/70', 'Unverified'],
  ['3 Musketeers', 'Mars, Incorporated'],
  ['5 Gum', 'Mars (Wrigley)'],
  ['7Days', 'Mondelēz International'],
  ['7th Heaven', 'Montagne Jeunesse'],
  ['7UP', 'Keurig Dr Pepper (US); PepsiCo licensed operations in some international markets'],
  ['A & W Sarsaparilla', 'A&W brand rights vary by market; Fraser and Neave in some Asian markets †'],
  ['ABC Kecap Manis', 'Kraft Heinz'],
  ['Absolute Organic', 'Independent brand; ownership requires verification'],
  ['Abu Siouf', 'Unverified'],
  ['Acana', 'Mars (Champion Petfoods)'],
  ['Actimel', 'Danone'],
  ['Action', 'Action retail group; 3i Group is a major shareholder'],
  ['Activia', 'Danone'],
  ['AdeS', 'The Coca-Cola Company'],
  ['AdeZ', 'The Coca-Cola Company'],
  ['Adrenaline Rush', 'PepsiCo †'],
  ['Advance', 'Affinity Petcare (Agrolimen Group)'],
  ['Aero', 'Nestlé'],
  ['After Eight', 'Nestlé'],
  ['Agrifood Marketing', 'Unverified'],
  ['Aha', 'The Coca-Cola Company'],
  ['Al Arz Tahini', 'Al Arz Tahini, independent manufacturer'],
  ['Alesto', 'Lidl / Schwarz Group (private-label brand)'],
  ['Algida', 'The Magnum Ice Cream Company'],
  ['Almond Joy & Mounds', 'The Hershey Company'],
  ['Almond Joy', 'The Hershey Company'],
  ['Mounds', 'The Hershey Company'],
  ['Alpen Gold', 'Mondelēz International'],
  ['AlSafi', 'Al Safi Danone (Danone joint venture)'],
  ['Altoids', 'Mars'],
  ['Alvalle', 'PepsiCo'],
  ['American Heritage Chocolate', 'Mars'],
  ['Amora', 'Unilever'],
  ['Amstel', 'Heineken'],
  ['Anita Gelato', 'Anita Gelato'],
  ['Anna and Sarah – Dates', 'Anna and Sarah'],
  ['Aperol', 'Campari Group'],
  ['Apollinaris', 'The Coca-Cola Company'],
  ['Appletiser', 'The Coca-Cola Company'],
  ['Aqua', 'Danone'],
  ['Aqua Minerale', 'PepsiCo †'],
  ['AquaBona', 'The Coca-Cola Company'],
  ['Aquafina', 'PepsiCo'],
  ['Aquarade', 'Unverified'],
  ['Aquarius', 'The Coca-Cola Company'],
  ['Arisco', 'Unilever'],
  ['Arnott’s', 'The Arnott’s Group / KKR'],
  ['Arnott’s Biscuit', 'The Arnott’s Group / KKR'],
  ['Aroma Espresso Bar', 'Aroma Espresso Bar'],
  ['Arwa', 'The Coca-Cola Company'],
  ['Asian Delight', 'Unverified'],
  ['Au Bon Pain', 'Ampex Brands'],
  ['Authentic Tea House', 'The Coca-Cola Company'],
  ['Aviv Passover Matzos', 'Aviv'],
  ['A.1.', 'Kraft Heinz'],

  // ─── B ───
  ['Baby Ruth', 'Ferrero Group'],
  ['Badoit', 'Danone'],
  ['Baken-Ets', 'PepsiCo'],
  ['Bakers’ Choice', 'Unverified'],
  ['Balisto', 'Mars'],
  ['Bambi', 'Bambi a.d. / The Coca-Cola HBC Group'],
  ['Bango', 'Unilever'],
  ['Bankya', 'The Coca-Cola HBC Group †'],
  ['Bar One', 'Nestlé'],
  ['Baracke', 'Unverified'],
  ['Barbican', 'Aujan Coca-Cola Beverages Company †'],
  ['Barcel', 'Grupo Bimbo'],
  ['Bare', 'PepsiCo'],
  ['Barilla', 'Barilla Group'],
  ['Barilla Group', 'Barilla family'],
  ['Barista Bros', 'Coca-Cola Europacific Partners †'],
  ['barkTHINS', 'The Hershey Company'],
  ['Barni', 'Mondelēz International'],
  ['Barq’s', 'The Coca-Cola Company'],
  ['Battaglio', 'Battaglio'],
  ['belVita', 'Mondelēz International'],
  ['Ben & Jerry’s', 'The Magnum Ice Cream Company'],
  ['Ben’s Original', 'Mars'],
  ['Benedictino', 'The Coca-Cola Company †'],
  ['Benenuts Graines', 'PepsiCo'],
  ['Best Foods', 'Unilever'],
  ['Big Red', 'Keurig Dr Pepper †'],
  ['Bimbo', 'Grupo Bimbo'],
  ['Bingo Chips', 'ITC Limited'],
  ['Biopet', 'Unverified'],
  ['Blue Bunny', 'Ferrero Group (Wells Enterprises)'],
  ['Blue Ribbon Classics', 'Ferrero Group (Wells Enterprises)'],
  ['Bluebird', 'PepsiCo'],
  ['Bluey', 'Unverified'],
  ['BodyArmor', 'The Coca-Cola Company'],
  ['Bokomo', 'PepsiCo (Pioneer Foods)'],
  ['Bonux', 'Procter & Gamble'],
  ['Boost', 'Nestlé in some markets; other rights vary †'],
  ['Bounty (Mars)', 'Mars'],
  ['Bounty', 'Mars'],
  ['BournVita', 'Mondelēz International'],
  ['Bovril', 'Unilever'],
  ['Braun', 'Procter & Gamble; selected categories licensed †'],
  ['Breath Savers', 'The Hershey Company'],
  ['Brekkies', 'Affinity Petcare'],
  ['Bright Dairy & Food Co', 'Bright Food Group'],
  ['Brisa', 'The Coca-Cola Company †'],
  ['Brisk', 'Pepsi Lipton partnership †'],
  ['Brooke Bond', 'Unilever / divested tea operations depending on market †'],
  ['Brookside', 'The Hershey Company'],
  ['Bru', 'Hindustan Unilever'],
  ['Buitoni', 'Nestlé / licensed or divested operations by market †'],
  ['Bunyad', 'Unilever †'],
  ['Buondi', 'Nestlé'],
  ['Butterfinger', 'Ferrero Group'],
  ['Buxton', 'Nestlé'],
  ['Bwild', 'Unverified'],

  // ─── C ───
  ['Cadbury Animals', 'Mondelēz International †'],
  ['Cadbury Chocolate', 'Mondelēz International; Hershey holds certain US licenses'],
  ['Cadbury', 'Mondelēz International; Hershey holds certain US licenses'],
  ['Cadbury Ice Cream', 'Licensed brand; ice-cream operating rights vary †'],
  ['Cailler', 'Nestlé'],
  ['Calippo', 'The Magnum Ice Cream Company'],
  ['Calisur', 'Unverified'],
  ['Calvé', 'Unilever'],
  ['Campa Cola', 'Reliance Consumer Products'],
  ['Campa Lemon', 'Reliance Consumer Products'],
  ['Campa Orange', 'Reliance Consumer Products'],
  ['Campofrio Food Group', 'Sigma / Alfa corporate group †'],
  ['Canada Dry', 'Keurig Dr Pepper (North America); rights vary elsewhere'],
  ['CanineX', 'Unverified'],
  ['Cap’n Crunch', 'PepsiCo'],
  ['Cappy', 'The Coca-Cola Company'],
  ['Capri Sun', 'Capri-Sun Group; Kraft Heinz has held regional licensing rights †'],
  ['Caribou Coffee', 'JAB Holding Company'],
  ['Carlsberg', 'Carlsberg Group'],
  ['Carnation', 'Nestlé'],
  ['Celsius', 'Celsius Holdings; PepsiCo strategic investor'],
  ['Cepita', 'The Coca-Cola Company †'],
  ['Cerelac', 'Nestlé'],
  ['Cesar', 'Mars'],
  ['Chaudfontaine', 'The Coca-Cola Company'],
  ['Chipsmore', 'Mondelēz International'],
  ['Chipsy', 'PepsiCo'],
  ['Chirat', 'Unilever'],
  ['Chitato', 'Indofood'],
  ['Chocapic', 'Nestlé / Cereal Partners Worldwide'],
  ['Choclitos', 'PepsiCo †'],
  ['Chokis', 'Mondelēz International'],
  ['Chokito', 'Nestlé'],
  ['Christie', 'Mondelēz International'],
  ['Chunk', 'Unverified'],
  ['Coca-Cola', 'The Coca-Cola Company'],
  ['Coca-Cola Zero', 'The Coca-Cola Company'],
  ['CocoaVia', 'Mars'],
  ['Coffee-Mate', 'Nestlé'],
  ['Colman’s', 'Unilever'],
  ['Combos', 'Mars'],
  ['Comcast Corp.', 'Comcast Corporation'],
  ['Continental', 'Unilever †'],
  ['Cornetto', 'The Magnum Ice Cream Company'],
  ['Corona Extra', 'AB InBev / Grupo Modelo'],
  ['Country Club', 'PepsiCo †'],
  ['Cracker Jack', 'PepsiCo'],
  ['Cream Bell', 'RJ Corp / Devyani Food Industries †'],
  ['Cremissimo', 'The Magnum Ice Cream Company †'],
  ['Cruskits', 'Arnott’s Group'],
  ['Cruzcampo', 'Heineken'],
  ['Crystal', 'Multiple unrelated brands; market required'],
  ['Cup-a-Soup', 'Unilever'],
  ['Côte d’Or', 'Mondelēz International'],

  // ─── D–E ───
  ['D. Hay Marketing LTD', 'Unverified'],
  ['Dabur', 'Dabur India'],
  ['Daim', 'Mondelēz International'],
  ['Danette', 'Danone'],
  ['Danone', 'Danone S.A.'],
  ['Darlie', 'Hawley & Hazel / Colgate-Palmolive joint venture †'],
  ['Dasani', 'The Coca-Cola Company'],
  ['De Todito', 'PepsiCo'],
  ['De Vegetarische Slager', 'Unilever †'],
  ['Deadsea Collection LTD', 'Unverified'],
  ['Deep RiverRock', 'The Coca-Cola Company'],
  ['Desert Diamond', 'Unverified'],
  ['Desert Tamar', 'Unverified'],
  ['Desperados', 'Heineken'],
  ['DFS', 'Multiple businesses use this name; unverified'],
  ['Diablo Sugar Free Chocolate Cake', 'Diablo / brand owner requires verification'],
  ['Diet Coke', 'The Coca-Cola Company'],
  ['DiGiorno', 'Nestlé'],
  ['Dogadan', 'Jacobs Douwe Egberts / tea ownership requires current verification †'],
  ['Doppio Coffee', 'Unverified'],
  ['Doritos', 'PepsiCo'],
  ['Dorna', 'The Coca-Cola Company †'],
  ['Dorot', 'Diplomat Holdings / ownership requires verification †'],
  ['Dot’s Homestyle Pretzels', 'The Hershey Company'],
  ['Doublemint', 'Mars'],
  ['Dr. Organic', 'Dr. Organic Group †'],
  ['DRIVE ME', 'Unverified'],
  ['Drumstick', 'Nestlé-branded in some markets; Froneri or other ice-cream operators †'],
  ['Duplo', 'Ferrero Group'],
  ['Duyvis', 'PepsiCo'],
  ['Earthborn Holistic', 'Midwestern Pet Foods'],
  ['Eat Natural', 'Ferrero Group'],
  ['Edy’s', 'Froneri'],
  ['Einstein Bros Bagels', 'Panera Brands / JAB Holding'],
  ['El Aguila', 'Multiple brands; unverified'],
  ['Elementor', 'Elementor Ltd.'],
  ['Elite Instant Coffee', 'Strauss Group'],
  ['Elma Chips', 'PepsiCo'],
  ['Elvive', 'L’Oréal'],
  ['El Monaguillo', 'Unverified'],
  ['Eqlibri', 'PepsiCo †'],
  ['Erel Dates', 'Unverified'],
  ['Erikli', 'Nestlé'],
  ['EspressoHouse', 'Espresso House Group / JAB Holding †'],
  ['Essentia Water', 'Nestlé'],
  ['Estathé', 'Ferrero Group'],
  ['Ever Clean', 'Clorox'],
  ['Evervess', 'PepsiCo'],
  ['EveryDay', 'Nestlé'],
  ['Evian', 'Danone'],
  ['Evolve', 'PepsiCo †'],
  ['Extrafino', 'Unverified'],

  // ─── F–H ───
  ['Fairlife', 'The Coca-Cola Company'],
  ['Falim', 'Mondelēz International'],
  ['Farmer Naturals Medjoul DattelIn', 'Unverified'],
  ['Fatti Per Te', 'Unverified'],
  ['Feast', 'The Magnum Ice Cream Company'],
  ['Febreze', 'Procter & Gamble'],
  ['Fenty', 'Fenty businesses; ownership varies by venture'],
  ['Ferrero Brioss', 'Ferrero Group'],
  ['Ferrero Küsschen', 'Ferrero Group'],
  ['Ferrero Rocher', 'Ferrero Group'],
  ['Field Day', 'Independent/private-label brand; verify entity'],
  ['Field Produce LTD', 'Unverified'],
  ['Fiesta', 'Multiple unrelated brands; unverified'],
  ['Fiji Water', 'The Wonderful Company'],
  ['Fiora Vanti', 'Unverified'],
  ['Flash', 'Procter & Gamble'],
  ['Flashlyte', 'Unverified'],
  ['Flower INC', 'Unverified'],
  ['Flowers Foods', 'Flowers Foods Inc.'],
  ['Fofura', 'PepsiCo †'],
  ['Font Vella', 'Danone'],
  ['Fontaneda', 'Mondelēz International'],
  ['Food to Live', 'Food to Live'],
  ['foodspring', 'Mars'],
  ['Fox’s Biscuits', 'Ferrero Group / Fox’s Burton’s Companies †'],
  ['Freeway', 'Lidl / Schwarz Group'],
  ['Freia', 'Mondelēz International'],
  ['Fresca', 'The Coca-Cola Company'],
  ['Fresca Toronja', 'The Coca-Cola Company'],
  ['Frestea', 'The Coca-Cola Company †'],
  ['Friskies', 'Nestlé Purina'],
  ['Frisko', 'The Magnum Ice Cream Company †'],
  ['Frito-Lay', 'PepsiCo'],
  ['Fritos', 'PepsiCo'],
  ['Froneri International', 'Froneri (Nestlé and PAI Partners joint venture)'],
  ['Froneri Extreme', 'Froneri'],
  ['Fruita Vitals', 'Unverified'],
  ['Fruitopia', 'The Coca-Cola Company †'],
  ['Fruko', 'Unilever †'],
  ['Frutta e Bacche', 'Unverified'],
  ['Funyuns', 'PepsiCo'],
  ['Fuse Tea', 'The Coca-Cola Company'],
  ['Fuze', 'The Coca-Cola Company'],
  ['Fuze Tea', 'The Coca-Cola Company'],
  ['Gail’s Bakery', 'Bread Holdings / Bain Capital †'],
  ['Galaxy', 'Mars'],
  ['Globus', 'Multiple businesses; unverified'],
  ['Gloria', 'Gloria Foods / Grupo Gloria, depending on market'],
  ['Glow & Handsome', 'Unilever'],
  ['Godrej', 'Godrej Group'],
  ['Gold Peak Tea', 'The Coca-Cola Company'],
  ['Halls', 'Mondelēz International'],
  ['Halo Top', 'Wells Enterprises / Ferrero Group'],
  ['Halos', 'Wonderful Citrus / The Wonderful Company'],
  ['Hamim Vetaim', 'Unverified'],
  ['Hanuta', 'Ferrero Group'],
  ['Hardee’s', 'CKE Restaurants'],
  ['Haribo', 'Haribo Group'],
  ['Hawai', 'The Coca-Cola Company †'],
  ['Hawai Tropical', 'The Coca-Cola Company †'],
  ['Hayat', 'Multiple businesses; unverified'],
  ['Heinz', 'Kraft Heinz'],
  ['Hellmann’s', 'Unilever'],
  ['Hershey’s', 'The Hershey Company'],
  ['Hershey’s Kisses', 'The Hershey Company'],
  ['Hubba Bubba', 'Mars'],

  // ─── I–L ───
  ['Ichnusa', 'Heineken'],
  ['Jack Daniel’s', 'Brown-Forman'],
  ['Jack Link’s', 'Link Snacks'],
  ['Jacob’s', 'Pladis / Yıldız Holding in the UK; rights vary †'],
  ['Jafaden', 'Unverified'],
  ['Jawara', 'Unilever †'],
  ['JDE Peet’s', 'JDE Peet’s / ownership subject to acquisition changes †'],
  ['Jell-O', 'Kraft Heinz'],
  ['JETZ', 'Indofood †'],
  ['Jim Patterson Food Group', 'Unverified'],
  ['Jolly Rancher', 'The Hershey Company'],
  ['Jordan River', 'Unverified'],
  ['Jordan River Dates', 'Unverified'],
  ['KitKat', 'Nestlé globally; Hershey US license'],
  ['Kissan', 'Unilever'],
  ['Kiwi Blue', 'Unverified'],
  ['Klondike', 'The Magnum Ice Cream Company'],
  ['Knorr', 'Unilever'],
  ['Koko Krunch', 'Nestlé / Cereal Partners Worldwide'],
  ['Kuat Guarana', 'The Coca-Cola Company †'],
  ['Kuner', 'Unilever †'],
  ['Kurkure', 'PepsiCo'],
  ['Kurma Royale', 'Unverified'],
  ['Kwality Wall’s', 'Unilever / The Magnum Ice Cream Company †'],
  ['Kykkos Natural Mineral Water', 'Unverified'],
  ['L’OR Coffee', 'JDE Peet’s'],
  ['La Cremeria', 'Nestlé-branded / Froneri operations vary †'],
  ['La Grande Épicerie Paris', 'Le Bon Marché / LVMH'],
  ['La Lechera', 'Nestlé'],
  ['Lean Cuisine', 'Nestlé'],
  ['Leon’s Fruit Shop', 'Unverified'],
  ['LesserEvil', 'The Hershey Company'],
  ['Lewis Cellars', 'The Wonderful Company'],
  ['Libby’s', 'Brand rights split by product and geography †'],
  ['Lipton', 'Pepsi Lipton partnership for certain ready-to-drink beverages; Ekaterra / Lipton Teas and Infusions for tea †'],
  ['Lipton Ice Tea', 'Pepsi Lipton partnership in relevant markets'],
  ['LiquiFruit', 'Pioneer Foods / PepsiCo'],
  ['Lizano', 'Kraft Heinz'],
  ['Looza', 'PepsiCo †'],

  // ─── M–P ───
  ['Maggi', 'Nestlé'],
  ['Magnum', 'The Magnum Ice Cream Company'],
  ['Maille', 'Unilever'],
  ['Maizena', 'Unilever in many markets; rights vary †'],
  ['Mallo', 'Unverified'],
  ['Maltesers', 'Mars'],
  ['Maltova', 'Unilever †'],
  ['Manantial', 'The Coca-Cola Company †'],
  ['Manhattan Bagel', 'Panera Brands / Einstein Bros Bagels †'],
  ['Mani Moto', 'Unverified'],
  ['Manzanita Sol', 'PepsiCo'],
  ['Marabou', 'Mondelēz International'],
  ['Mars', 'Mars, Incorporated'],
  ['Maxwell House', 'Kraft Heinz'],
  ['Mentos', 'Perfetti Van Melle'],
  ['Mercadona', 'Mercadona S.A.'],
  ['Mezzo Mix', 'The Coca-Cola Company'],
  ['Michelob Ultra', 'AB InBev'],
  ['Mighty Sesame', 'Rushdi Food Industries †'],
  ['Miss Vickie’s', 'PepsiCo'],
  ['Mon Chéri', 'Ferrero Group'],
  ['Mondelēz', 'Mondelēz International'],
  ['Movenpick', 'Nestlé / Froneri in licensed ice-cream and coffee markets; hospitality rights divided †'],
  ['Munchies', 'Nestlé (confectionery); PepsiCo also uses Munchies for snacks'],
  ['Munchos', 'PepsiCo'],
  ['Muscle Milk', 'PepsiCo'],
  ['Nestlé', 'Nestlé S.A.'],
  ['One Brands', 'The Hershey Company'],
  ['One Coconut Water', 'Unverified'],
  ['Ooha', 'PepsiCo †'],
  ['OpenTable', 'Booking Holdings'],
  ['Orbia Advance Corporation', 'Orbia Advance Corporation'],
  ['Orbit', 'Mars'],
  ['Ore-Ida', 'Kraft Heinz'],
  ['Oreo', 'Mondelēz International'],
  ['Pret A Manger', 'JAB Holding Company'],
  ['Prigat', 'The Coca-Cola Company †'],
  ['Prince', 'Mondelēz International'],
  ['Pringles', 'Mars (Kellanova)'],
  ['Propel', 'PepsiCo'],
  ['Pudliszki', 'Kraft Heinz'],
  ['Pump', 'The Coca-Cola Company †'],

  // ─── R–S ───
  ['Sao', 'Arnott’s Group'],
  ['SariWangi', 'Unilever / tea brand ownership subject to regional changes †'],
  ['Saskia', 'Lidl / Schwarz Group'],
  ['Sasko', 'PepsiCo / Pioneer Foods'],
  ['Savanna', 'Distell / Heineken Beverages'],
  ['Savora', 'Unilever'],
  ['Savoy', 'Nestlé †'],
  ['Schesir', 'Agras Pet Foods / ownership requires current verification †'],
  ['Toddy', 'PepsiCo in Brazil †'],
  ['Toddynho', 'PepsiCo'],
  ['Toma', 'PepsiCo †'],
  ['Topo Chico', 'The Coca-Cola Company'],
  ['Torcida', 'PepsiCo'],
  ['Tostitos', 'PepsiCo'],
  ['Treatles', 'Unverified'],
  ['Trencito', 'Nestlé'],
  ['Tnuva', 'Bright Food Group'],
  ['Toblerone', 'Mondelēz International'],
  ['Tropicana', 'Tropicana Brands Group; PepsiCo retains a minority interest'],
  ['Trovet', 'Trovet / ownership requires verification'],
  ['Tru Fru', 'Mars'],
  ['Tuborg', 'Carlsberg Group'],
  ['Tuc', 'Mondelēz International in many markets; rights vary †'],
  ['Tum-e Yummies', 'PepsiCo †'],

  // ─── T–Z ───
  ['Turkuaz Su', 'Unverified'],
  ['Twister Pineapple', 'PepsiCo †'],
  ['Twisties', 'PepsiCo'],
  ['Twistos', 'PepsiCo'],
  ['Twix', 'Mars'],
  ['Twizzler', 'The Hershey Company'],
  ['Ultima', 'Affinity Petcare'],
  ['Ultimates', 'Unverified'],
  ['Unilever', 'Unilever PLC'],
  ['Unox Matic', 'Unilever / Unox brand; product-specific verification required'],
  ['Unox', 'Unilever'],
  ['Urban Platter', 'Urban Platter'],
  ['Urge', 'The Coca-Cola Company'],
  ['Valpre', 'The Coca-Cola Company †'],
  ['Valser', 'The Coca-Cola Company'],
  ['Velveeta', 'Kraft Heinz'],
  ['Vemondo', 'Lidl / Schwarz Group'],
  ['Venom Energy', 'Keurig Dr Pepper'],
  ['Ventura', 'Multiple businesses; unverified'],
  ['Vetlife', 'Farmina Pet Foods'],
  ['VetSolution', 'Monge'],
  ['Viennetta', 'The Magnum Ice Cream Company'],
  ['Vilas', 'Unverified'],
  ['Vim', 'Unilever'],
  ['Vimto', 'Nichols plc'],
  ['Vio', 'The Coca-Cola Company'],
  ['Vita-Wheat', 'Arnott’s Group'],
  ['Vitakraft', 'Vitakraft Group'],
  ['Vital', 'Multiple brands; unverified'],
  ['Vitale', 'Multiple brands; unverified'],
  ['Vitalinea', 'Danone'],
  ['Vittel', 'Nestlé'],
  ['Viva', 'Multiple brands; unverified'],
  ['Volvic', 'Danone'],
  ['Wagner Steinofen Pizza', 'Nestlé'],
  ['Wagner', 'Nestlé'],
  ['Waitrose', 'John Lewis Partnership'],
  ['Wasabröd', 'Barilla Group'],
  ['Wattie’s', 'Kraft Heinz'],
  ['Whatchamacallit', 'The Hershey Company'],
  ['Wheat Thins', 'Mondelēz International'],
  ['White Star', 'PepsiCo / Pioneer Foods'],
  ['Whittard Chelsea', 'Whittard of Chelsea'],
  ['Whoppers', 'The Hershey Company'],
  ['Wilkins', 'The Coca-Cola Company †'],
  ['Winterfresh', 'Mars'],
  ['Wonderful Pistachios', 'The Wonderful Company'],
  ['Wrigley’s', 'Mars'],
  ['Wrigley’s Extra', 'Mars'],
  ['Extra', 'Mars (Wrigley)'],
  ['Wrigley’s Spearmint', 'Mars'],
  ['Xferas', 'Unverified'],
  ['Yachak', 'PepsiCo †'],
  ['Yarden Houmous', 'Yarden / ownership requires verification'],
  ['Yedigun', 'PepsiCo †'],
  ['YoCrunch', 'Danone †'],
  ['Yogurette', 'Ferrero Group'],
  ['York', 'The Hershey Company'],
  ['Yum! Brands', 'Yum! Brands, Inc.'],
  ['YumYum', 'Multiple brands; market required'],
  ['Zacin', 'Unverified'],
  ['Zagnut', 'The Hershey Company'],
  ['Zico', 'Independent brand; formerly Coca-Cola-owned'],

  // ─── Additional brands mentioned in original company descriptions ───
  ['Acqua Panna', 'Nestlé'],
  ['Axe / Lynx', 'Unilever'],
  ['Axe', 'Unilever'],
  ['Lynx', 'Unilever'],
  ['Bear Brand', 'Nestlé'],
  ['Blédina', 'Danone'],
  ['Cheetos', 'PepsiCo'],
  ['Cheerios', 'General Mills; Nestlé/General Mills joint venture in certain markets'],
  ['Chips Ahoy!', 'Mondelēz International'],
  ['Chips Ahoy', 'Mondelēz International'],
  ['Classico', 'Kraft Heinz'],
  ['Clorets', 'Mondelēz International †'],
  ['Closeup', 'Unilever'],
  ['Comfort', 'Unilever'],
  ['Crunch', 'Nestlé in selected markets; Ferrero in the US'],
  ['Dentyne', 'Mondelēz International †'],
  ['Dermalogica', 'Unilever'],
  ['Dolmio', 'Mars'],
  ['Domestos', 'Unilever'],
  ['Dove', 'Unilever (personal care); Mars (chocolate brand in the US)'],
  ['Eukanuba', 'Mars in certain markets; Spectrum Brands in Europe †'],
  ['Fannie May', 'Ferrero Group'],
  ['Felix', 'Nestlé Purina'],
  ['Froot Loops', 'Ferrero / WK Kellogg in North America; Kellanova-related rights elsewhere †'],
  ['Frosted Flakes', 'Ferrero / WK Kellogg in North America †'],
  ['Garden Gourmet', 'Nestlé'],
  ['Gatorade', 'PepsiCo'],
  ['Gerber', 'Nestlé'],
  ['Grey Poupon', 'Kraft Heinz'],
  ['Häagen-Dazs', 'General Mills in many markets; Froneri (Nestlé JV) in US/selected territories †'],
  ['Honest Tea', 'Former Coca-Cola brand; discontinued in the US'],
  ['Horlicks', 'Unilever in India and certain markets; rights vary'],
  ['Hot Pockets', 'Nestlé'],
  ['International Delight', 'Danone'],
  ['Iams', 'Mars in certain markets; Spectrum Brands in Europe †'],
  ['K18', 'Unilever'],
  ['Kashi', 'Ferrero / WK Kellogg in North America †'],
  ['Keebler', 'Ferrero Group'],
  ['Kisses', 'The Hershey Company'],
  ['Lactogen', 'Nestlé'],
  ['Lay’s', 'PepsiCo'],
  ['Lays', 'PepsiCo'],
  ['Life Cereal', 'PepsiCo'],
  ['Lifebuoy', 'Unilever'],
  ['Liquid I.V.', 'Unilever'],
  ['Lux', 'Unilever'],
  ['Milka', 'Mondelēz International'],
  ['Milo', 'Nestlé'],
  ['Minute Maid', 'The Coca-Cola Company'],
  ['NAN', 'Nestlé'],
  ['Nature’s Bounty', 'Nestlé Health Science historically; divestment status requires verification'],
  ['Nescafé', 'Nestlé'],
  ['Nescafe', 'Nestlé'],
  ['Nespresso', 'Nestlé'],
  ['Nesquik', 'Nestlé'],
  ['Nestea', 'Nestlé brand; licensing and operating rights vary'],
  ['Nido', 'Nestlé'],
  ['Nutella', 'Ferrero Group'],
  ['Nutricia', 'Danone'],
  ['Nutrafol', 'Unilever'],
  ['Omo', 'Unilever'],
  ['Oscar Mayer', 'Kraft Heinz'],
  ['Pedigree', 'Mars'],
  ['Pepsodent', 'Unilever'],
  ['Perrier', 'Nestlé'],
  ['Philadelphia', 'Kraft Heinz in North America; Mondelēz in certain other markets'],
  ['Pirate’s Booty', 'The Hershey Company'],
  ['Pond’s', 'Unilever'],
  ['Powerade', 'The Coca-Cola Company'],
  ['Purina', 'Nestlé'],
  ['Quality Street', 'Nestlé'],
  ['Quaker', 'PepsiCo'],
  ['Raffaello', 'Ferrero Group'],
  ['Reese’s', 'The Hershey Company'],
  ['Reeses', 'The Hershey Company'],
  ['Rexona / Sure', 'Unilever'],
  ['Rexona', 'Unilever'],
  ['Sure', 'Unilever'],
  ['Rice Krispies', 'Ferrero / WK Kellogg in North America; rights vary internationally †'],
  ['Ritz', 'Mondelēz International'],
  ['Rockstar', 'PepsiCo'],
  ['Rolo', 'Nestlé in many markets; Hershey US license'],
  ['Royal Canin', 'Mars'],
  ['S.Pellegrino', 'Nestlé'],
  ['San Pellegrino', 'Nestlé'],
  ['Seattle’s Best Coffee', 'Nestlé'],
  ['Sheba', 'Mars'],
  ['Silk', 'Danone'],
  ['Skittles', 'Mars'],
  ['Smarties', 'Nestlé in many markets; distinct US brand exists'],
  ['Snickers', 'Mars'],
  ['So Delicious', 'Danone'],
  ['Special K', 'Ferrero / WK Kellogg in North America; rights vary internationally †'],
  ['Sprite', 'The Coca-Cola Company'],
  ['Starburst', 'Mars'],
  ['Starbucks Coffee At Home', 'Nestlé global licensing arrangement'],
  ['Stouffer’s', 'Nestlé'],
  ['Stride', 'Mondelēz International †'],
  ['Sunlight', 'Unilever'],
  ['Sunsilk', 'Unilever'],
  ['Surf', 'Unilever'],
  ['TRESemmé', 'Unilever'],
  ['Tidy Cats', 'Nestlé Purina'],
  ['Tic Tac', 'Ferrero Group'],
  ['Toll House', 'Nestlé'],
  ['Trix', 'General Mills; Nestlé/General Mills joint venture in selected markets'],
  ['Vaseline', 'Unilever'],
  ['Walkers', 'PepsiCo'],
  ['Whiskas', 'Mars'],
  ['yfood', 'Nestlé †'],
  ['Zoégas', 'Nestlé'],
  ['Fanta', 'The Coca-Cola Company'],
  ['Kinder', 'Ferrero Group'],
  ['Kinder Bueno', 'Ferrero Group'],
  ['M&M’s', 'Mars, Incorporated'],
  ['M&Ms', 'Mars, Incorporated'],
  ['Kraft', 'Kraft Heinz'],
  ['Wall’s', 'The Magnum Ice Cream Company']
];

/**
 * Parses a raw `[brandName, rawParentText]` row into a structured, deterministic relationship record.
 * Strictly separates `unverified` / ambiguous rows from verified parent company links.
 */
export function parseBrandParentRow(brandName: string, rawParentText: string): ParsedBrandRelationship {
  const cleanBrand = brandName.trim();
  const rawParent = rawParentText.trim();
  const lowerParent = rawParent.toLowerCase();

  // 1. Strict Unverified / Ambiguous Guard: NEVER auto-flag these
  const isUnverifiedOrAmbiguous =
    lowerParent === 'unverified' ||
    lowerParent.includes('multiple unrelated brands') ||
    lowerParent.includes('multiple businesses') ||
    lowerParent.includes('multiple brands; unverified') ||
    lowerParent.includes('multiple brands; market required') ||
    lowerParent.includes('ownership requires verification') ||
    lowerParent.includes('ownership requires current verification') ||
    lowerParent.includes('brand owner requires verification') ||
    lowerParent.includes('verify entity') ||
    lowerParent.includes('brand rights split by product and geography') ||
    lowerParent.includes('licensed brand; ice-cream operating rights vary') ||
    lowerParent.includes('formerly coca-cola-owned') ||
    lowerParent.includes('former coca-cola brand; discontinued') ||
    lowerParent.includes('divestment status requires verification') ||
    lowerParent.includes('ownership varies by venture') ||
    lowerParent.includes('brand rights vary by market');

  if (isUnverifiedOrAmbiguous) {
    return {
      brandName: cleanBrand,
      normalizedBrand: normalizeEntityKey(cleanBrand),
      parentCompany: 'Unverified',
      normalizedParent: 'unverified',
      rawParentText: rawParent,
      relationshipType: 'unverified',
      notes: rawParent,
      sourceUrl: 'https://bdsmovement.net'
    };
  }

  // 2. Extract primary parent company and regional/† notes
  const hasDagger = rawParent.includes('†');
  const cleanedWithoutDagger = rawParent.replace(/\s*†\s*/g, '').trim();
  const asciiCleaned = cleanedWithoutDagger
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'");

  let primaryParentCandidate = cleanedWithoutDagger;
  let notes: string | null = hasDagger ? rawParent : null;

  // Handle explicit known multi-company / regional note patterns deterministically
  const knownComplexPatterns: Array<{ match: RegExp; parent: string; relType?: ParsedBrandRelationship['relationshipType'] }> = [
    { match: /^Nestle\s*\/\s*Cereal Partners Worldwide/i, parent: 'Cereal Partners Worldwide', relType: 'joint_venture' },
    { match: /^Nestle\s*\/\s*Froneri/i, parent: 'Froneri', relType: 'joint_venture' },
    { match: /^Nestle-branded/i, parent: 'Nestlé S.A.', relType: 'licensed' },
    { match: /^Nestle\s+Purina/i, parent: 'Nestlé Purina', relType: 'subsidiary' },
    { match: /^Nestle\b/i, parent: 'Nestlé S.A.' },
    { match: /^Froneri \(Nestle/i, parent: 'Froneri', relType: 'joint_venture' },
    { match: /^Mondelez International/i, parent: 'Mondelēz International' },
    { match: /^Mondelez\b/i, parent: 'Mondelēz International' },
    { match: /^The Coca-Cola Company/i, parent: 'The Coca-Cola Company' },
    { match: /^The Coca-Cola HBC Group/i, parent: 'The Coca-Cola HBC Group' },
    { match: /^Bambi a\.d\. \/ The Coca-Cola HBC Group/i, parent: 'The Coca-Cola HBC Group' },
    { match: /^Aujan Coca-Cola Beverages Company/i, parent: 'Aujan Coca-Cola Beverages Company' },
    { match: /^Coca-Cola Europacific Partners/i, parent: 'Coca-Cola Europacific Partners' },
    { match: /^PepsiCo \(Pioneer Foods\)/i, parent: 'PepsiCo (Pioneer Foods)' },
    { match: /^Pioneer Foods \/ PepsiCo/i, parent: 'PepsiCo (Pioneer Foods)' },
    { match: /^PepsiCo \/ Pioneer Foods/i, parent: 'PepsiCo (Pioneer Foods)' },
    { match: /^PepsiCo\b/i, parent: 'PepsiCo' },
    { match: /^Pepsi Lipton partnership/i, parent: 'Pepsi Lipton partnership', relType: 'joint_venture' },
    { match: /^Ekaterra .* Pepsi Lipton partnership/i, parent: 'Pepsi Lipton partnership', relType: 'joint_venture' },
    { match: /^Keurig Dr Pepper \(US\); PepsiCo/i, parent: 'PepsiCo', relType: 'licensed' },
    { match: /^Celsius Holdings; PepsiCo/i, parent: 'PepsiCo', relType: 'joint_venture' },
    { match: /^Tropicana Brands Group; PepsiCo/i, parent: 'PepsiCo', relType: 'joint_venture' },
    { match: /^Mars \(Wrigley\)/i, parent: 'Mars (Wrigley)' },
    { match: /^Mars \(Kellanova\)/i, parent: 'Mars (Kellanova)' },
    { match: /^Mars \(Champion Petfoods\)/i, parent: 'Mars (Champion Petfoods)' },
    { match: /^Mars\b/i, parent: 'Mars, Incorporated' },
    { match: /^Ferrero Group \(Wells Enterprises\)/i, parent: 'Ferrero Group (Wells Enterprises)' },
    { match: /^Wells Enterprises \/ Ferrero Group/i, parent: 'Ferrero Group (Wells Enterprises)' },
    { match: /^Ferrero Group \/ Fox's Burton's Companies/i, parent: "Ferrero Group / Fox's Burton's Companies" },
    { match: /^Ferrero \/ WK Kellogg/i, parent: 'Ferrero / WK Kellogg' },
    { match: /^Ferrero Group/i, parent: 'Ferrero Group' },
    { match: /^The Hershey Company/i, parent: 'The Hershey Company' },
    { match: /^Kraft Heinz/i, parent: 'Kraft Heinz' },
    { match: /^Capri-Sun Group; Kraft Heinz/i, parent: 'Kraft Heinz', relType: 'licensed' },
    { match: /^Unilever/i, parent: 'Unilever PLC' },
    { match: /^Hindustan Unilever/i, parent: 'Hindustan Unilever' },
    { match: /^The Magnum Ice Cream Company/i, parent: 'The Magnum Ice Cream Company' },
    { match: /^Al Safi Danone/i, parent: 'Al Safi Danone', relType: 'joint_venture' },
    { match: /^Danone/i, parent: 'Danone S.A.' },
    { match: /^Procter & Gamble/i, parent: 'Procter & Gamble' },
    { match: /^General Mills; Nestle\/General Mills/i, parent: 'Cereal Partners Worldwide', relType: 'joint_venture' },
    { match: /^General Mills in many markets; Froneri/i, parent: 'Froneri', relType: 'joint_venture' },
    { match: /^Lidl \/ Schwarz Group/i, parent: 'Lidl / Schwarz Group' },
    { match: /^The Arnott's Group \/ KKR|^Arnott's Group/i, parent: "The Arnott's Group / KKR" },
    { match: /^Affinity Petcare/i, parent: 'Affinity Petcare (Agrolimen Group)' },
    { match: /^Wonderful Citrus \/ The Wonderful Company|^The Wonderful Company/i, parent: 'The Wonderful Company' }
  ];

  let relationshipType: ParsedBrandRelationship['relationshipType'] = 'subsidiary';

  for (const rule of knownComplexPatterns) {
    if (rule.match.test(asciiCleaned)) {
      primaryParentCandidate = rule.parent;
      if (rule.relType) relationshipType = rule.relType;
      if (cleanedWithoutDagger !== rule.parent && !notes) {
        notes = rawParent;
      }
      break;
    }
  }

  const canonicalParent =
    CANONICAL_PARENT_MAP[normalizeEntityKey(primaryParentCandidate)] || primaryParentCandidate;

  return {
    brandName: cleanBrand,
    normalizedBrand: normalizeEntityKey(cleanBrand),
    parentCompany: canonicalParent,
    normalizedParent: normalizeEntityKey(canonicalParent),
    rawParentText: rawParent,
    relationshipType,
    notes,
    sourceUrl: 'https://bdsmovement.net'
  };
}

/**
 * Builds the complete deduplicated list of parsed brand relationships (including intermediate parent links).
 */
export function buildFullBrandRelationships(): ParsedBrandRelationship[] {
  const map = new Map<string, ParsedBrandRelationship>();

  for (const [brand, rawParent] of RAW_BRAND_PARENT_ROWS) {
    const parsed = parseBrandParentRow(brand, rawParent);
    if (!parsed.normalizedBrand) continue;
    map.set(`${parsed.normalizedBrand}::${parsed.normalizedParent}`, parsed);
  }

  for (const link of INTERMEDIATE_PARENT_LINKS) {
    const normSub = normalizeEntityKey(link.subsidiary);
    const canonicalParent = CANONICAL_PARENT_MAP[normalizeEntityKey(link.parentCompany)] || link.parentCompany;
    const normParent = normalizeEntityKey(canonicalParent);
    const key = `${normSub}::${normParent}`;
    if (!map.has(key)) {
      map.set(key, {
        brandName: link.subsidiary,
        normalizedBrand: normSub,
        parentCompany: canonicalParent,
        normalizedParent: normParent,
        rawParentText: link.parentCompany,
        relationshipType: link.relationshipType,
        notes: link.notes || null,
        sourceUrl: 'https://bdsmovement.net'
      });
    }
  }

  return Array.from(map.values());
}
