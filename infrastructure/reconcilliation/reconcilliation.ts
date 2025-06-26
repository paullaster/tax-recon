import { AppError } from "../../domain/entities/error.ts";
import type { IReconcilliationProvider } from "../../domain/repositories/providers.ts";
import type { TaxItemHeader } from "../../types/types.ts";
import safeTypeChecker from "../../utils/safe-type-checker.ts";
import type { ItaxConfig } from "../config/itax.ts";
import { open, type FileHandle } from 'node:fs/promises';


const ERROR_RESPONSES_LOG = 'error_responses.log';
const SUCCESSFUL_RESPONSES_LOG = 'successful_responses.log';
const CATCH_ERRORS_LOG = 'catch_errors.log';

class LogManager {
    private static instance: LogManager;
    private logHandles: Map<string, FileHandle> = new Map();

    private constructor() { } // Private constructor to enforce singleton

    public static getInstance(): LogManager {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
        }
        return LogManager.instance;
    }
    public async initializeLogFiles(): Promise<void> {
        try {
            console.log('LogManager: Initializing log files...');
            this.logHandles.set(SUCCESSFUL_RESPONSES_LOG, await open(SUCCESSFUL_RESPONSES_LOG, 'a'));
            this.logHandles.set(ERROR_RESPONSES_LOG, await open(ERROR_RESPONSES_LOG, 'a'));
            this.logHandles.set(CATCH_ERRORS_LOG, await open(CATCH_ERRORS_LOG, 'a'));
            console.log('LogManager: Log files opened successfully.');

            // Ensure files are closed when the process exits
            process.on('beforeExit', this.closeLogFiles.bind(this));
            process.on('SIGINT', async () => { // Handle Ctrl+C
                await this.closeLogFiles();
                process.exit(0);
            });
            process.on('SIGTERM', async () => { // Handle termination signals
                await this.closeLogFiles();
                process.exit(0);
            });

        } catch (error) {
            console.error('LogManager: Failed to open log files:', error);
            // Depending on criticality, you might want to throw here or exit
            throw new Error('Failed to initialize logging system.');
        }
    }
    public async appendToLog(filename: string, data: any): Promise<void> {
        const handle = this.logHandles.get(filename);
        if (!handle) {
            console.error(`LogManager: Attempted to write to uninitialized log file: ${filename}. Please call initializeLogFiles() first.`);
            return; // Return without writing if handle is not found
        }
        try {
            const logEntry = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            await handle.appendFile(`${logEntry}\n`); // Use FileHandle.appendFile for explicit appending
        } catch (logError) {
            console.error(`LogManager: Failed to write to log file ${filename}:`, logError);
        }
    }
    public async closeLogFiles(): Promise<void> {
        console.log('LogManager: Closing log files...');
        for (const [filename, handle] of this.logHandles.entries()) {
            try {
                await handle.close();
                console.log(`LogManager: Closed ${filename}`);
            } catch (error) {
                console.error(`LogManager: Error closing ${filename}:`, error);
            }
        }
        this.logHandles.clear(); // Clear the map
        console.log('LogManager: All log files closed.');
    }
}

export const logManager = LogManager.getInstance();

export class ReconcilliationProvider implements IReconcilliationProvider {
    constructor() {

    }
    async transmitTaxItem(taxItem: TaxItemHeader, itaxConfig: ItaxConfig): Promise<object | undefined> {
        try {
            console.log("tax item: ", taxItem.TraderSystemInvNum);
            if (safeTypeChecker(taxItem) !== 'Object' || safeTypeChecker(itaxConfig) !== 'Object') throw new AppError('Invalid tax item or itax config');
            const res = await fetch(itaxConfig.integrationUrl, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Undici-Stream',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taxItem),
            });
            if (!res.ok) {
                const errorResponse = {
                    status: res.status,
                    statusText: res.statusText,
                    url: res.url,
                    taxItemTraderSystemInvNum: taxItem.TraderSystemInvNum, // Include identifier for context
                    // You might want to read res.json() or res.text() here if the API provides error details in body
                    body: await res.text().catch(() => 'N/A') // Attempt to read body, catch if stream is consumed
                };
                console.log('HTTP Error Response:', errorResponse); // Keep console log for immediate feedback
                await logManager.appendToLog(ERROR_RESPONSES_LOG, errorResponse);
                // throw new AppError(`${res.statusText}`)
            }
            const response = await res.json();
            console.log('API Success Response: ', response); // Keep console log for immediate feedback
            await logManager.appendToLog(SUCCESSFUL_RESPONSES_LOG, { response, taxItemTraderSystemInvNum: taxItem.TraderSystemInvNum });
            return { success: true, response };
        } catch (error: any) {
            const errorMessage = `Reconcilliation Provider > TransmitTaxItem: ${error.message}`;
            console.log(errorMessage);
            // throw new AppError(`Reconcilliation Provider > TransmitTaxItem: ${error.message} `)
            await logManager.appendToLog(CATCH_ERRORS_LOG, { error: errorMessage, taxItemTraderSystemInvNum: taxItem?.TraderSystemInvNum || 'N/A' });
        }
    }
}