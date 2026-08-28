import { AuthoritativeRecipe } from './RecipeProvider';

export class RecipeDeduplicator {
  private seenIds = new Set<string>();
  private seenImages = new Set<string>();
  private seenSignatures = new Set<string>();

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.seenIds.clear();
    this.seenImages.clear();
    this.seenSignatures.clear();
  }

  /**
   * Generates a semantic canonical signature for dish deduplication.
   */
  public generateSignature(recipe: AuthoritativeRecipe): string {
    const title = (recipe.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const tokens = title.split(/\s+/).filter(t => t.length > 2);
    tokens.sort();
    return `${recipe.meal_category}-${tokens.slice(0, 3).join('_')}`;
  }

  /**
   * Checks if a recipe is a duplicate by ID, Image URL, or Semantic Signature.
   */
  public isDuplicate(recipe: AuthoritativeRecipe): { duplicate: boolean; reason?: string } {
    const idKey = recipe.id || recipe.external_id;
    if (this.seenIds.has(idKey)) {
      return { duplicate: true, reason: `Duplicate recipe ID: ${idKey}` };
    }

    if (recipe.image_url && this.seenImages.has(recipe.image_url)) {
      return { duplicate: true, reason: `Duplicate image URL detected: ${recipe.image_url}` };
    }

    const signature = this.generateSignature(recipe);
    if (this.seenSignatures.has(signature)) {
      return { duplicate: true, reason: `Semantic dish duplicate: "${recipe.title}" (${signature})` };
    }

    return { duplicate: false };
  }

  /**
   * Registers a validated recipe into deduplication tracking.
   */
  public register(recipe: AuthoritativeRecipe): void {
    const idKey = recipe.id || recipe.external_id;
    this.seenIds.add(idKey);
    if (recipe.image_url) {
      this.seenImages.add(recipe.image_url);
    }
    this.seenSignatures.add(this.generateSignature(recipe));
  }
}
