// ...existing code...
import type { Request, Response } from 'express';
import type { IReconcilliationService } from '../../domain/repositories/services.ts';
// ...existing code...
export class ReconcilliationController {
    private dataService: IReconcilliationService;
    constructor(dataService: IReconcilliationService) {
        this.dataService = dataService;
    }
    async initiateReconcilliation(req: Request, res: Response) {
        try {
            let recordSize: number | null = null;
            if (req.body && req.body.recordSize) {
                recordSize = Number(req.body.recordSize);
            }
            const transmitted = await this.dataService.transmit();
            if (!transmitted) return res.status(500).json({ message: 'Error occurred!' });
            if ('success' in transmitted && !transmitted.success) return res.status(400).json({ message: 'message' in transmitted ? transmitted.message : 'Not transmitted!' });
            return res.status(200).json({
                message: 'Transmission was successful',
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}