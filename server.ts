import config from './infrastructure/config/index.ts';
import cluster from 'node:cluster';
import os from 'node:os';
import app from './app.ts';



const PORT = config.app.PORT;
const numCPUs = parseInt(config.cluster.clusterWorkers || os.cpus().length.toString(), 10);

// Start server
function startServer() {
    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT} (PID: ${process.pid})`);
    });
    // Graceful shutdown
    const shutdown = () => {
        console.log('Received shutdown signal, closing server...');
        server.close(() => {
            console.log('Server closed gracefully.');
            process.exit(0);
        });
        // Force exit if not closed in 10s
        setTimeout(() => {
            console.error('Force exiting after 10s.');
            process.exit(1);
        }, 10000);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

if (cluster.isPrimary) {
    console.log(`Primary process ${process.pid} is running. Spawning ${numCPUs} workers...`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
        cluster.fork();
    });
} else {
    startServer();
}