import { AppError } from "../../domain/entities/error.ts";
import type { DatasetProvider, IReconcilliationProvider } from "../../domain/repositories/providers.ts";
import type { IReconcilliationService } from "../../domain/repositories/services.ts";
import type { ItaxConfig } from "../../infrastructure/config/itax.ts";
import type { TaxItemHeader, TaxItemLines } from "../../types/types.ts";
import safeTypeChecker from "../../utils/safe-type-checker.ts";

export class ReconcilliationService implements IReconcilliationService {
    private dataProvider: DatasetProvider;
    private reconcilliationProvider: IReconcilliationProvider;
    private config: ItaxConfig;
    constructor(dataProvider: DatasetProvider, reconcilliationProvider: IReconcilliationProvider, config: ItaxConfig) {
        this.dataProvider = dataProvider;
        this.reconcilliationProvider = reconcilliationProvider;
        this.config = config;
    }
    async transmit(): Promise<object> {
        try {
            for (const ch of this.dataProvider.getDataset()) {
                const { lines, ...header } = ch;
                if (!lines) return { success: false, message: 'Invalid tax item.' };
                const headerValidation = this.validateTaxItemHeader(header as TaxItemHeader);
                if (!headerValidation) throw new AppError('Tax item header could not be validated');
                if ('valid' in headerValidation && !headerValidation.valid) throw new AppError(headerValidation?.message ?? 'Invalid tax item header');
                lines.forEach((line: TaxItemLines, index: number) => {
                    const lineValidation = this.validateTaxItemLine(line);
                    if (!lineValidation) throw new AppError(`Tax item line ${index + 1} could not be validated`);
                    if ('valid' in lineValidation && !lineValidation.valid) throw new AppError(lineValidation?.message ?? `Invalid tax item line ${index + 1}`);
                });
                // console.log(ch);
                const res = await this.reconcilliationProvider.transmitTaxItem(ch, this.config);
                console.log('Request response: ', res);
            }
            return { success: true, message: 'Transmitted successfully!' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Transmission failed.' };
        }
    }
    validateTaxItemHeader(header: TaxItemHeader): { valid: boolean; message?: string } | undefined {
        try {
            if (safeTypeChecker(header) !== 'Object')
                return { valid: false };
            if (
                !header.CompanyName ||
                !header.ClientPINnum ||
                !header.postingDate ||
                !header.TraderSystemInvNum ||
                !header.RelatedInvoiceNum
            ) {
                return { valid: false, message: 'Missing required field(s)' };
            }
            return { valid: true }
        } catch (error: any) {
            return { valid: false, message: `RECON VALIDATION > HEADER: ${error.message} ` };
        }
    }
    validateTaxItemLine(line: TaxItemLines): { valid: boolean; message?: string } | undefined {
        try {
            if (safeTypeChecker(line) !== 'Object') return { valid: false, message: ' Invalid line' };
            if (
                !line.NamePLU ||
                !line.OptionVATClass ||
                safeTypeChecker(line.Price) !== 'Number' ||
                !line.Price ||
                safeTypeChecker(line.VATGrRate) !== 'Number' ||
                safeTypeChecker(line.Quantity) !== 'Number' ||
                !line.Quantity
            ) {
                return { valid: false, message: 'Missing required line property!.' }
            }
            return { valid: true };
        } catch (error: any) {
            return { valid: false, message: `RECOD VALIDATION > LINE: ${error.message} ` };
        }
    }
}