import { readFileSync, writeFileSync } from 'fs';
import { EJParser } from './infrastructure/data/ejPaerser.ts';
import type { Invoice } from './types/types.ts';


// Usage: ts-node cli.ts <input_ej_file> <output_json_file>
async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
        console.error('Usage: ts-node cli.ts <input_ej_file> <output_json_file>');
        process.exit(1);
    }

    const inputFilePath = args[0];
    const outputFilePath = args[1];

    try {
        const fileContent = readFileSync(inputFilePath, 'utf-8');
        const parser = new EJParser();
        const invoices: Invoice[] = parser.parse(fileContent);

        writeFileSync(outputFilePath, JSON.stringify(invoices, null, 2), 'utf-8');
        console.log(`Successfully parsed "${inputFilePath}" and saved to "${outputFilePath}"`);

    } catch (error: any) {
        console.error(`Error processing file: ${error.message}`);
        process.exit(1);
    }
}

main();