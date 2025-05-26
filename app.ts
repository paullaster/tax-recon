import express from 'express'
import { setRoutes } from './interface/routes/index.routes.ts';
import { errorHandler } from './interface/controllers/errorHandler.ts';

const app = express();
app.use(express.json({ limit: '4096mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '4096mb' }));

setRoutes(app);

app.use(errorHandler);

export default app;