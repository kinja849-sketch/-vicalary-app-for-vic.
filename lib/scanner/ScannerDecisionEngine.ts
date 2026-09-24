import { ScannedProduct } from './types';
import { BoycottScreeningService } from './BoycottScreeningService';
import { BarcodeService } from '../products/BarcodeService';

export class ScannerDecisionEngine {
  static async processScan(barcode: string, userId: string, countryCode: string = 'US') {
    try {
      // 1. Identify Product Authoritatively
      const productData = await BarcodeService.processScan(barcode, countryCode);
      const product = productData.product;
      
      if (!product) {
        return { status: "PRODUCT_NOT_FOUND", barcode };
      }

      // 2. Boycott Screening
      if (product.brand) {
        const boycottStatus = await BoycottScreeningService.screenBrand(product.brand, userId);
        
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
