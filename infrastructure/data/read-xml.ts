// const XLSX = require('xlsx');
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

function extractColumnValues(filePath: string, sheetName: string, columnName: string) {
    try {
        // Read the Excel file
        const workbook = XLSX.readFile(filePath);

        // Get the desired sheet
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            console.error(`Error: Sheet '${sheetName}' not found in the workbook.`);
            return [];
        }

        // Convert the worksheet to JSON to easily access data by column header
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const columnValues = [];
        // Iterate through each row and extract the value from the specified column
        for (const row of jsonData) {
            if (row.hasOwnProperty(columnName)) {
                columnValues.push(row[columnName]);
            } else {
                console.warn(`Warning: Column '${columnName}' not found in one or more rows. Skipping row.`);
            }
        }

        return columnValues;

    } catch (error) {
        console.error(`An error occurred while extracting values: ${error.message}`);
        return [];
    }
}

function saveValuesToFile(values, outputPath) {
    try {
        // Join the values with a newline character for a simple text file, or comma for CSV
        const fileContent = values.join('\n'); // Change to values.join(',') for CSV (if single row per value is desired)

        writeFileSync(outputPath, fileContent, 'utf8');
        console.log(`Successfully saved extracted values to: ${outputPath}`);
    } catch (error: any) {
        console.error(`An error occurred while saving to file: ${error.message}`);
    }
}

// --- Usage Example ---
const excelFilePath = 'AutopopulatedreportKRAMay2025.(2).xlsx'; // Replace with your Excel file path
const targetSheetName = 'Sheet1';            // Replace with your sheet name
const targetColumnName = 'CU INV';           // Replace with the exact name of your column
const outputFilePath = 'may_extracted_cu_inv.json'; // <--- Specify your desired output file path here

// Extract values
const extractedValues = extractColumnValues(excelFilePath, targetSheetName, targetColumnName);

if (extractedValues.length > 0) {
    console.log(`Extracted ${extractedValues.length} values from '${targetColumnName}'.`);
    // Save extracted values to a file
    saveValuesToFile(extractedValues, outputFilePath);
} else {
    console.log(`No values found or extracted from column '${targetColumnName}'.`);
}