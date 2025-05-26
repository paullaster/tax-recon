import type { TaxItemHeader, TaxItemLines } from "../../types/types.ts";

export interface IReconcilliationService {
    transmit(): Promise<object> | undefined;
    validateTaxItemHeader(header: TaxItemHeader): object | undefined
    validateTaxItemLine(line: TaxItemLines): object | undefined;
}