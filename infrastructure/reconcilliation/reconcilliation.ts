import { AppError } from "../../domain/entities/error.ts";
import type { IReconcilliationProvider } from "../../domain/repositories/providers.ts";
import type { TaxItemHeader } from "../../types/types.ts";
import safeTypeChecker from "../../utils/safe-type-checker.ts";
import type { ItaxConfig } from "../config/itax.ts";

export class ReconcilliationProvider implements IReconcilliationProvider {
    constructor() {

    }
    async transmitTaxItem(taxItem: TaxItemHeader, itaxConfig: ItaxConfig): Promise<object | undefined> {
        try {
            if (safeTypeChecker(taxItem) !== 'Object' || safeTypeChecker(itaxConfig) !== 'Object') throw new AppError('Invalid tax item or itax config');
            const res = await fetch(itaxConfig.integrationUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Undici-Stream',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taxItem),
            });
            const response = await res.json();
            console.log(response);
            return { success: true, response };
        } catch (error: any) {
            throw new AppError(`Reconcilliation Provider > TransmitTaxItem: ${error.message} `)
        }
    }
}