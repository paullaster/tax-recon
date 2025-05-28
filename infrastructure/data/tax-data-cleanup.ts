import { open } from 'node:fs/promises';
import { AppError } from '../../domain/entities/error.ts';
import type { TaxItemHeader } from '../../types/types.ts';
import writeXlsxFile from 'write-excel-file/node';
import type { DataService } from '../../domain/repositories/providers.ts';
import type { Cell, Row, Schema, SheetData } from 'write-excel-file';
export class DataCleaningService implements DataService {
    private data: string[];
    private cus: string[];
    constructor() {
        this.data = [];
        this.cus = [];
    }
    async getDataFromPath(path: string) {
        try {
            const file = await open(path, 'r');

            for await (const chunk of file.readableWebStream()) {
                Buffer.from(chunk).toString();
                this.data.push(Buffer.from(chunk).toString());
            }
            await file.close();
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
    async extractCUNumbers(path: string) {
        try {
            const file = await open(path, 'r');
            const CUNumbers: string[] = [];
            let remainingPartialLine = '';

            for await (const chunk of file.readableWebStream()) {
                const currentChunkString = Buffer.from(chunk).toString('utf8');
                const processingString = remainingPartialLine + currentChunkString;
                const lines = processingString.split('\n');
                remainingPartialLine = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('CU Invoice N:')) {
                        CUNumbers.push(trimmedLine);
                    }
                }
            }
            if (remainingPartialLine.trim().startsWith('CU Invoice N:')) {
                CUNumbers.push(remainingPartialLine.trim());
            }
            await file.close();
            this.cus = CUNumbers.map((cu: string) => cu.split(':')[1]);
        } catch (error: any) {
            throw new AppError(`Error at Extracting CU NO. > EXTRACT NUMBERS > ${error.message}`);
        }
    }
    async createCUNumbersExcel() {
        try {
            const dataForExcel: Row[] = [
                ...(this.cus as string[]).map(num => [{ value: num } as Cell])
            ];

            const schema: Schema<any> = [
                {
                    column: 'CU Invoice Number',
                    type: String,
                    width: 30,
                    value: (row: any) => row[0].value,
                }
            ];
            await writeXlsxFile(dataForExcel, {
                schema,
                filePath: 'CU_Numbers_from_ej_report.xlsx',
            });
        } catch (error: any) {
            throw new AppError(`Error > EXCEL SHEET. ${error.message}`);
        }
    }
}


const dataService = new DataCleaningService();
console.log(await dataService.extractCUNumbers('P051825856W.EJ'));
console.log(await dataService.createCUNumbersExcel());