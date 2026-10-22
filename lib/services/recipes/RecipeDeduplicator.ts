import { AuthoritativeRecipe } from './RecipeProvider';
import { getCanonicalImageKey } from '@/lib/services/FoodImageService';

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
    return `${recipe.meal_category}-${tokens.join('_')}`;
  }

  /**
   * Checks if a recipe is a duplicate by ID, Image URL, or Semantic Signature.
   */
  public isDuplicate(recipe: AuthoritativeRecipe): { duplicate: boolean; reason?: string } {
    const idKey = String(recipe.id || recipe.external_id || '').trim();
    if (idKey && this.seenIds.has(idKey)) {
      return { duplicate: true, reason: `Duplicate recipe ID: ${idKey}` };
    }

    const signature = this.generateSignature(recipe);
    if (this.seenSignatures.has(signature)) {
      return { duplicate: true, reason: `Semantic dish duplicate: "${recipe.title}" (${signature})` };
    }

    if (recipe.image_url) {
      const imgKey = getCanonicalImageKey(recipe.image_url);
      if (imgKey && this.seenImages.has(imgKey)) {
        return { duplicate: true, reason: `Duplicate image key: ${imgKey}` };
      }
    }

    return { duplicate: false };
  }

  /**
   * Registers a validated recipe into deduplication tracking.
   */
  public register(recipe: AuthoritativeRecipe): void {
    const idKey = String(recipe.id || recipe.external_id || '').trim();
    if (idKey) {
      this.seenIds.add(idKey);
    }
    if (recipe.image_url) {
      this.seenImages.add(getCanonicalImageKey(recipe.image_url));
    }
    this.seenSignatures.add(this.generateSignature(recipe));
  }
}
