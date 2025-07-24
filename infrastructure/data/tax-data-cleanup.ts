import { open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { AppError } from '../../domain/entities/error.ts';
import type { TaxItemHeader } from '../../types/types.ts';
import writeXlsxFile from 'write-excel-file/node';
import type { DataService } from '../../domain/repositories/providers.ts';
import type { Cell, Row, Schema } from 'write-excel-file';
import { cuArray } from '../../cu-numbers-0.ts';
import { finished } from 'node:stream/promises';
import JSONStream from 'jsonstream';
export class DataCleaningService implements DataService {
    // private data: string[];
    private cus: string[];
    constructor() {
        // this.data = [];
        this.cus = [];
    }
    getDataFromPath(path: string): NodeJS.ReadableStream {
        return createReadStream(path, { encoding: 'utf8' });
        // try {
        //     const file = await open(path, 'r');

        //     for await (const chunk of file.readableWebStream()) {
        //         Buffer.from(chunk).toString();
        //         this.data.push(Buffer.from(chunk).toString());
        //     }
        //     await file.close();
        // } catch (error) {
        //     console.log('GETTING DATA FROM FILE', error);
        // }
    }

    // async prepareData(): Promise<TaxItemHeader[] | undefined> {
    //     try {
    //         this.data = this.data.map((item) => {
    //             return JSON.parse(item);
    //         })
    //         return this.data.flat() as unknown as TaxItemHeader[];
    //     } catch (error) {
    //         console.log('PREPARE DATA: ', error);
    //     }
    // }
    async prepareData(filePath: string): Promise<TaxItemHeader[] | undefined> {
        try {
            console.log(`PREPARE DATA: Starting to process file: ${filePath}`);
            const dataStream = this.getDataFromPath(filePath);
            const parsedData: TaxItemHeader[] = [];

            // Initialize the jsonstream parser.
            // JSONStream.parse('*') is crucial: it listens for each top-level
            // object within a JSON array and emits it as a 'data' event.
            const jsonParser = JSONStream.parse('*');

            // Pipe the file stream through the JSON parser.
            // Data flows: readStream -> jsonParser -> 'data' events
            dataStream
                .pipe(jsonParser)
                .on('data', (item: TaxItemHeader) => {
                    // Each 'data' event provides a complete, parsed JSON object.
                    // This object is then pushed into our results array.
                    parsedData.push(item);
                })
                .on('error', (err) => {
                    // Handle parsing errors. This is more robust than JSON.parse() on chunks.
                    console.error('PREPARE DATA: JSON parsing error:', err);
                    // Re-throw the error to be caught by the outer try-catch block
                    // and to reject the 'finished' promise.
                    throw err;
                });

            // Ensure errors from the readStream are also caught.
            dataStream.on('error', (err) => {
                console.error('PREPARE DATA: File read stream error:', err);
                // Propagate the error.
                throw err;
            });

            // Wait for the entire stream pipeline to finish.
            // This promise resolves when jsonParser has processed all data
            // (or rejects if an error occurs in any part of the pipeline).
            await finished(jsonParser);

            console.log(`PREPARE DATA: Successfully processed ${parsedData.length} records from ${filePath}`);
            return parsedData;
        } catch (error) {
            console.error('PREPARE DATA: An error occurred during data preparation:', error);
            return undefined; // Return undefined to indicate failure
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
    async *getInvoicesToReconcile() {
        try {
            let i = 0;
            while (i < (cuArray.length - 1)) {
                yield cuArray[i];
            }
        } catch (error) {
            console.log(error);
        }
    }
}


// const dataService = new DataCleaningService();
// console.log(await dataService.extractCUNumbers('P051825856W.EJ'));
// console.log(await dataService.createCUNumbersExcel());
// dataService.getDataFromPath();
// dataService.prepareData();
// console.log(await dataService.getInvoicesToReconcile().next())
// dataService.invoiceData('extracted-invoices-from-ej-file.json');