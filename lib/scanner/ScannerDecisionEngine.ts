import { BoycottScreeningService } from './BoycottScreeningService';
import { BarcodeService } from '../products/BarcodeService';
import { ExtractedLabelRecord } from '../ocr/NutritionalLabelOCRService';

export class ScannerDecisionEngine {
  static async processScan(
    barcode: string,
    userId: string,
    countryCode: string = 'US',
    ipAddress?: string,
    packageImage?: string,
    options?: {
      servingsConsumed?: number;
      weightConsumedG?: number;
      consumeEntirePackage?: boolean;
      confirmedLabelRecord?: ExtractedLabelRecord;
    }
  ) {
    try {
      // 1. Identify Product Authoritatively from Catalog (Open Food Facts API v3 -> v2 -> v0)
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

      // 3. APPROVED Gate: Enrich product facts (panel OCR, physical label discrepancy check, food coloring) & resolve local price
      let enrichedProduct = await BarcodeService.enrichApprovedProductFacts(
        product,
        packageImage,
        options?.confirmedLabelRecord
      );

      if (
        options?.servingsConsumed !== undefined ||
        options?.weightConsumedG !== undefined ||
        options?.consumeEntirePackage
      ) {
        enrichedProduct = BarcodeService.calculateConsumptionForProduct(enrichedProduct, {
          servingsConsumed: options.servingsConsumed,
          weightConsumedG: options.weightConsumedG,
          consumeEntirePackage: options.consumeEntirePackage
        });
      }

      const pricing = await BarcodeService.priceProvider.getPrice(
        barcode,
        countryCode,
        enrichedProduct.category,
        enrichedProduct.name,
        ipAddress,
        enrichedProduct.size || enrichedProduct.serving_size,
        enrichedProduct.brand,
        enrichedProduct.origin_country
      );

      if (pricing?.shopping_market_country) {
        enrichedProduct.shopping_market_country = pricing.shopping_market_country;
      }

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
