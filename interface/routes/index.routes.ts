import { Router as ExpressRouter, type Application } from 'express';
import { reconcilliation } from './reconcilliation.routes.ts';

interface IApp extends Application { };

export const setRoutes = (app: IApp): void => {
    const router: ExpressRouter = ExpressRouter({ caseSensitive: true });
    router.use('/itax', reconcilliation);
    app.use(`/api`, router);
};
