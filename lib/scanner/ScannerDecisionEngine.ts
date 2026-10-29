import { BoycottScreeningService } from './BoycottScreeningService';
import { BarcodeService } from '../products/BarcodeService';

export class ScannerDecisionEngine {
  static async processScan(
    barcode: string,
    userId: string,
    countryCode: string = 'US',
    ipAddress?: string,
    packageImage?: string
  ) {
    try {
      // 1. Identify Product Authoritatively from Catalog
      const product = await BarcodeService.identifyProduct(barcode, packageImage);

      if (!product) {
        return { status: 'PRODUCT_NOT_FOUND', barcode };
      }

      // 2. Parent-First Boycott Screening Gate (runs BEFORE OCR enrichment and pricing)
      if (product.brand || product.name) {
        const boycottStatus = await BoycottScreeningService.screenBrand(
          product.brand || '',
          userId,
          product.name
        );

        if (boycottStatus.flagged) {
          return {
            status: 'FLAGGED',
            product,
            boycottDetails: boycottStatus,
            alternatives: []
          };
        }
      }

      // 3. APPROVED Gate: Enrich product facts (panel OCR if catalog empty, food coloring analysis) & resolve local price
      const enrichedProduct = await BarcodeService.enrichApprovedProductFacts(product, packageImage);
      const pricing = await BarcodeService.priceProvider.getPrice(
        barcode,
        countryCode,
        enrichedProduct.category,
        enrichedProduct.name,
        ipAddress,
        enrichedProduct.size || enrichedProduct.serving_size,
        enrichedProduct.brand
      );

      return {
        status: 'APPROVED',
        product: enrichedProduct,
        pricing,
        nutrition: enrichedProduct.nutrition
      };
    } catch (error: any) {
      if (error.message && error.message.includes('could not be authoritatively identified')) {
        return { status: 'PRODUCT_NOT_FOUND', barcode };
      }
      console.error('[ScannerDecisionEngine]', error);
      return { status: 'ERROR', message: error.message };
    }
  }
}
