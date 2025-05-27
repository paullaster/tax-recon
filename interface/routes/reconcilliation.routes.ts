import { Router as ReconcilliationRouter } from "express";
import { ReconcilliationController } from "../controllers/reconcilliation-controller.ts";
import { ReconcilliationService } from "../../application/services/reconcilliationService.ts";
import { DatasetsProvider } from "../../infrastructure/data/data.ts";
import { DataCleaningService } from "../../infrastructure/data/tax-data-cleanup.ts";
import type { TaxItemHeader } from "../../types/types.ts";
import { ReconcilliationProvider } from "../../infrastructure/reconcilliation/reconcilliation.ts";
import config from "../../infrastructure/config/index.ts";



const reconcilliation = ReconcilliationRouter({ caseSensitive: true });

const dataset = new DataCleaningService();
await dataset.getDataFromPath('credit-memos-dataset.json');
const datasetProvider = new DatasetsProvider(await dataset.prepareData() as TaxItemHeader[]);
const reconcilliationProvider = new ReconcilliationProvider();
const reconcilliationService = new ReconcilliationService(datasetProvider, reconcilliationProvider, config.itax);
const reconcilliationController = new ReconcilliationController(reconcilliationService);

reconcilliation.post('/transmit', (req, res, next) => {
    Promise.resolve(reconcilliationController.initiateReconcilliation(req, res))
        .catch(next);
});

export { reconcilliation };