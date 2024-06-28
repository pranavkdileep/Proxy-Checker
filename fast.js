const fs = require('fs');
const readline = require('readline');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const INPUT_FILE = 'proxies.txt';
const HIGH_FILE = 'high.txt';
const MEDIUM_FILE = 'medium.txt';
const LOW_FILE = 'low.txt';
const DEAD_FILE = 'dead.txt';
const THREAD_COUNT = 10; // Number of threads

// Clear or create the output files
if (isMainThread) {
    [HIGH_FILE, MEDIUM_FILE, LOW_FILE, DEAD_FILE].forEach(file => fs.writeFileSync(file, ''));

    const proxies = fs.readFileSync(INPUT_FILE, 'utf-8').split('\n').filter(line => line);

    const chunkSize = Math.ceil(proxies.length / THREAD_COUNT);
    for (let i = 0; i < THREAD_COUNT; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunk = proxies.slice(start, end);

        const worker = new Worker(__filename, {
            workerData: chunk
        });

        worker.on('message', (message) => {
            if (message.type === 'result') {
                const { proxy, category } = message;
                fs.appendFileSync(`${category}.txt`, `${proxy}\n`);
            }
        });
    }

    console.log('Main thread: Dispatched all workers');
} else {
    const axios = require('axios');
    const { performance } = require('perf_hooks');
    const { SocksProxyAgent } = require('socks-proxy-agent');

    const TIMEOUT = 10000; // 10 seconds timeout

    const categorizeProxy = async (proxy) => {
        const [protocol, address] = proxy.split('://');
        const [host, port] = address.split(':');

        let agent;
        if (protocol === 'http') {
            agent = null;
        } else if (protocol === 'socks4' || protocol === 'socks5') {
            agent = new SocksProxyAgent(`${protocol}://${host}:${port}`);
        } else {
            parentPort.postMessage({ type: 'result', proxy, category: 'dead' });
            return;
        }

        const start = performance.now();
        try {
            await axios.get('https://www.google.com', {
                proxy: protocol === 'http' ? { host, port: parseInt(port) } : false,
                httpAgent: agent,
                httpsAgent: agent,
                timeout: TIMEOUT
            });
            const end = performance.now();
            const responseTime = end - start;

            let category;
            if (responseTime < 3000) {
                category = 'high';
            } else if (responseTime < 5000) {
                category = 'medium';
            } else {
                category = 'low';
            }

            parentPort.postMessage({ type: 'result', proxy, category });
        } catch (error) {
            parentPort.postMessage({ type: 'result', proxy, category: 'dead' });
        }
    };

    const checkProxies = async (proxies) => {
        for (const proxy of proxies) {
            await categorizeProxy(proxy);
        }
    };

    checkProxies(workerData);
}
