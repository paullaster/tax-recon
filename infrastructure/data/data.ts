import type { DatasetProvider } from "../../domain/repositories/providers.ts";
import type { TaxItemHeader } from "../../types/types.ts";

export class DatasetsProvider implements DatasetProvider {
    private dataset: TaxItemHeader[]
    constructor(data: TaxItemHeader[]) {
        this.dataset = data;
    }
    *getDataset() {
        let currentItemNumber: number = 0;
        while (this.dataset.length > currentItemNumber) {
            yield this.dataset[currentItemNumber];
            currentItemNumber++;
        }
    }

}