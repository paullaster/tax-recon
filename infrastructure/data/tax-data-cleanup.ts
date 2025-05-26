import { open } from 'node:fs/promises';
import type { TaxItemHeader } from '../../types/types.ts';
import type { DataService } from '../../domain/repositories/providers.ts';
export class DataCleaningService implements DataService {
    private data: string[];
    constructor() {
        this.data = [];
    }
    async getDataFromPath(path: string) {
        try {
            const file = await open(path);

            for await (const chunk of file.readableWebStream()) {
                Buffer.from(chunk).toString();
                this.data.push(Buffer.from(chunk).toString());
                await file.close();
            }
        } catch (error) {
            console.log('GETTING DATA FROM FILE', error);
        }
    }

    async prepareData(): Promise<TaxItemHeader[] | undefined> {
        try {
            this.data = this.data.map((item) => {
                return JSON.parse(item);
            })
            return this.data.flat() as unknown as TaxItemHeader[];
        } catch (error) {
            console.log('PREPARE DATA: ', error);
        }
    }
}