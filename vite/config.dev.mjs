import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        // Fixed port for Last Night — 8081 avoids clashing with the other project on 8080.
        port: 8081
    }
});
