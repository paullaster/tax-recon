import type { ItaxConfig } from "../../infrastructure/config/itax.ts";
import type { TaxItemHeader } from "../../types/types.ts";

export interface DataService {
    getDataFromPath(path: string): Promise<void>;
    prepareData(): Promise<TaxItemHeader[] | undefined>
}

export interface DatasetProvider {
    getDataset(): IterableIterator<TaxItemHeader>;
}

export interface IReconcilliationProvider {
    transmitTaxItem(taxItem: TaxItemHeader, itaxConfig: ItaxConfig): Promise<object | undefined>
}