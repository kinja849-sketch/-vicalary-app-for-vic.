import { ScannedProduct } from './types';
import { BoycottScreeningService } from './BoycottScreeningService';
import { BarcodeService } from '../products/BarcodeService';

export class ScannerDecisionEngine {
  static async processScan(barcode: string, userId: string, countryCode: string = 'US', ipAddress?: string, packageImage?: string) {
    try {
      // 1. Identify Product Authoritatively
      const productData = await BarcodeService.processScan(barcode, countryCode, ipAddress, packageImage);
      const product = productData.product;
      
      if (!product) {
        return { status: "PRODUCT_NOT_FOUND", barcode };
      }

      // 2. Parent-First Boycott Screening (resolves brand -> parent chain, or careful name-token -> brand -> parent when brand is missing)
      if (product.brand || product.name) {
        const boycottStatus = await BoycottScreeningService.screenBrand(
          product.brand || '',
          userId,
          product.name
        );
        
        if (boycottStatus.flagged) {
          return {
            status: "FLAGGED",
            product,
            boycottDetails: boycottStatus,
            alternatives: [] // Optional future implementation
          };
        }
      }
      
      // 3. Approved
      return {
        status: "APPROVED",
        product,
        pricing: productData.pricing,
        nutrition: product.nutrition
      };
    } catch (error: any) {
      if (error.message.includes("could not be authoritatively identified")) {
        return { status: "PRODUCT_NOT_FOUND", barcode };
      }
      console.error("[ScannerDecisionEngine]", error);
      return { status: "ERROR", message: error.message };
    }
  }
}
